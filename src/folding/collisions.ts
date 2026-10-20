import { analyzePolyhedron } from '../geometry/polyhedron'
import type { Point2D, Point3D, PolyhedronMesh } from '../geometry/types'
import type { UnfoldedNet } from '../geometry/unfolding'
import { dot, transformPoint } from './math'
import type { FoldPose } from './types'

export const COLLISION_EPSILON_MM = 1e-7

export type FaceIntersection = {
  firstFaceId: string
  secondFaceId: string
  kind: 'coplanar' | 'crossing'
  points: Point3D[]
}

type Triangle = [Point3D, Point3D, Point3D]
type FaceTriangles = { faceId: string; triangles: Triangle[] }

function subtract(a: Point3D, b: Point3D): Point3D {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}
function add(a: Point3D, b: Point3D): Point3D {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}
function scale(a: Point3D, amount: number): Point3D {
  return { x: a.x * amount, y: a.y * amount, z: a.z * amount }
}
function cross(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}
function length(a: Point3D): number {
  return Math.hypot(a.x, a.y, a.z)
}
function unit(a: Point3D): Point3D {
  const magnitude = length(a)
  return scale(a, 1 / magnitude)
}
function distance(a: Point3D, b: Point3D): number {
  return length(subtract(a, b))
}
function samePoint(a: Point3D, b: Point3D, tolerance: number): boolean {
  return distance(a, b) <= tolerance
}

function segmentTriangleIntersection(
  start: Point3D,
  end: Point3D,
  triangle: Triangle,
  tolerance: number,
): Point3D | null {
  const [a, b, c] = triangle
  const direction = subtract(end, start)
  const edge1 = subtract(b, a)
  const edge2 = subtract(c, a)
  const determinant = dot(edge1, cross(direction, edge2))
  if (Math.abs(determinant) <= tolerance) return null
  const inverse = 1 / determinant
  const fromA = subtract(start, a)
  const u = dot(fromA, cross(direction, edge2)) * inverse
  const q = cross(fromA, edge1)
  const v = dot(direction, q) * inverse
  const t = dot(edge2, q) * inverse
  if (
    u < -tolerance ||
    v < -tolerance ||
    u + v > 1 + tolerance ||
    t < -tolerance ||
    t > 1 + tolerance
  ) {
    return null
  }
  return add(start, scale(direction, Math.min(1, Math.max(0, t))))
}

function projectPoint(point: Point3D, droppedAxis: 'x' | 'y' | 'z'): Point2D {
  if (droppedAxis === 'x') return { x: point.y, y: point.z }
  if (droppedAxis === 'y') return { x: point.x, y: point.z }
  return { x: point.x, y: point.y }
}

function pointInTriangle2D(
  point: Point2D,
  triangle: Point2D[],
  tolerance: number,
) {
  const [a, b, c] = triangle
  const cross2 = (u: Point2D, v: Point2D, w: Point2D) =>
    (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x)
  const first = cross2(a, b, point)
  const second = cross2(b, c, point)
  const third = cross2(c, a, point)
  return (
    (first >= -tolerance && second >= -tolerance && third >= -tolerance) ||
    (first <= tolerance && second <= tolerance && third <= tolerance)
  )
}

function segmentIntersection2D(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  d: Point2D,
  tolerance: number,
): { t: number; u: number } | null {
  const rx = b.x - a.x
  const ry = b.y - a.y
  const sx = d.x - c.x
  const sy = d.y - c.y
  const denominator = rx * sy - ry * sx
  if (Math.abs(denominator) <= tolerance) return null
  const qx = c.x - a.x
  const qy = c.y - a.y
  const t = (qx * sy - qy * sx) / denominator
  const u = (qx * ry - qy * rx) / denominator
  return t >= -tolerance &&
    t <= 1 + tolerance &&
    u >= -tolerance &&
    u <= 1 + tolerance
    ? { t: Math.min(1, Math.max(0, t)), u: Math.min(1, Math.max(0, u)) }
    : null
}

function coplanarTriangleIntersections(
  first: Triangle,
  second: Triangle,
  normal: Point3D,
  tolerance: number,
): Point3D[] {
  const droppedAxis =
    Math.abs(normal.x) >= Math.abs(normal.y) &&
    Math.abs(normal.x) >= Math.abs(normal.z)
      ? 'x'
      : Math.abs(normal.y) >= Math.abs(normal.z)
        ? 'y'
        : 'z'
  const first2 = first.map((point) => projectPoint(point, droppedAxis))
  const second2 = second.map((point) => projectPoint(point, droppedAxis))
  const intersections: Point3D[] = []
  first.forEach((point, index) => {
    if (pointInTriangle2D(first2[index], second2, tolerance))
      intersections.push(point)
  })
  second.forEach((point, index) => {
    if (pointInTriangle2D(second2[index], first2, tolerance))
      intersections.push(point)
  })
  for (let firstIndex = 0; firstIndex < 3; firstIndex += 1) {
    const nextFirst = (firstIndex + 1) % 3
    for (let secondIndex = 0; secondIndex < 3; secondIndex += 1) {
      const nextSecond = (secondIndex + 1) % 3
      const hit = segmentIntersection2D(
        first2[firstIndex],
        first2[nextFirst],
        second2[secondIndex],
        second2[nextSecond],
        tolerance,
      )
      if (hit) {
        intersections.push(
          add(
            first[firstIndex],
            scale(subtract(first[nextFirst], first[firstIndex]), hit.t),
          ),
        )
      }
    }
  }
  return intersections
}

/** Returns intersection points for two triangles, including coplanar overlap. */
export function intersectTriangles3D(
  first: Triangle,
  second: Triangle,
  tolerance = COLLISION_EPSILON_MM,
): { kind: 'coplanar' | 'crossing'; points: Point3D[] } | null {
  const firstNormalRaw = cross(
    subtract(first[1], first[0]),
    subtract(first[2], first[0]),
  )
  const secondNormalRaw = cross(
    subtract(second[1], second[0]),
    subtract(second[2], second[0]),
  )
  if (
    length(firstNormalRaw) <= tolerance ||
    length(secondNormalRaw) <= tolerance
  )
    return null
  const firstNormal = unit(firstNormalRaw)
  const secondNormal = unit(secondNormalRaw)
  const parallel = length(cross(firstNormal, secondNormal)) <= tolerance
  const coplanar =
    parallel &&
    Math.abs(dot(subtract(second[0], first[0]), firstNormal)) <= tolerance
  let points: Point3D[]
  let kind: 'coplanar' | 'crossing'
  if (coplanar) {
    kind = 'coplanar'
    points = coplanarTriangleIntersections(
      first,
      second,
      firstNormal,
      tolerance,
    )
  } else {
    kind = 'crossing'
    points = []
    for (let index = 0; index < 3; index += 1) {
      const next = (index + 1) % 3
      const firstHit = segmentTriangleIntersection(
        first[index],
        first[next],
        second,
        tolerance,
      )
      const secondHit = segmentTriangleIntersection(
        second[index],
        second[next],
        first,
        tolerance,
      )
      if (firstHit) points.push(firstHit)
      if (secondHit) points.push(secondHit)
    }
  }
  const unique = points.filter(
    (point, index) =>
      points.findIndex((candidate) =>
        samePoint(candidate, point, tolerance * 2),
      ) === index,
  )
  return unique.length ? { kind, points: unique } : null
}

function segmentDistance(point: Point3D, start: Point3D, end: Point3D): number {
  const segment = subtract(end, start)
  const denominator = dot(segment, segment)
  if (denominator === 0) return distance(point, start)
  const t = Math.min(
    1,
    Math.max(0, dot(subtract(point, start), segment) / denominator),
  )
  return distance(point, add(start, scale(segment, t)))
}

function triangleFan(points: Point3D[]): Triangle[] {
  return points
    .slice(1, -1)
    .map((point, index) => [points[0], point, points[index + 2]])
}

function aabbOverlaps(
  first: Triangle,
  second: Triangle,
  tolerance: number,
): boolean {
  for (const axis of ['x', 'y', 'z'] as const) {
    const firstMin = Math.min(...first.map((point) => point[axis]))
    const firstMax = Math.max(...first.map((point) => point[axis]))
    const secondMin = Math.min(...second.map((point) => point[axis]))
    const secondMax = Math.max(...second.map((point) => point[axis]))
    if (firstMax < secondMin - tolerance || secondMax < firstMin - tolerance)
      return false
  }
  return true
}

/**
 * Checks non-adjacent faces in a folding pose. The paper model has zero
 * thickness; contacts between adjacent faces on their shared hinge are ignored.
 */
export function detectPolyhedronFaceIntersections(
  mesh: PolyhedronMesh,
  net: UnfoldedNet,
  poses: FoldPose[],
  tolerance = COLLISION_EPSILON_MM,
): FaceIntersection[] {
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new RangeError(
      'Collision tolerance must be a finite positive number.',
    )
  }
  const analysis = analyzePolyhedron(mesh)
  if (!analysis.valid)
    throw new RangeError(
      'Cannot check collisions for an invalid polyhedron mesh.',
    )
  const poseMap = new Map(poses.map((pose) => [pose.faceId, pose.transform]))
  const foldedFaces: FaceTriangles[] = mesh.faces.map((face) => {
    const netFace = net.faces.find((candidate) => candidate.id === face.id)
    const transform = poseMap.get(face.id)
    if (
      !netFace ||
      !transform ||
      netFace.vertexIds.length !== face.vertexIds.length
    ) {
      throw new RangeError(`Missing pose or unfolded face: ${face.id}`)
    }
    const center = netFace.polygon.reduce(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 },
    )
    const center2D = {
      x: center.x / netFace.polygon.length,
      y: center.y / netFace.polygon.length,
    }
    const points = netFace.polygon.map((point) =>
      transformPoint(transform, {
        x: point.x - center2D.x,
        y: point.y - center2D.y,
        z: 0,
      }),
    )
    return { faceId: face.id, triangles: triangleFan(points) }
  })
  const edgeByFacePair = new Map<string, [string, string]>()
  for (const edge of analysis.edges) {
    if (edge.adjacentFaceIds.length !== 2) continue
    const key = [...edge.adjacentFaceIds].sort().join('|')
    edgeByFacePair.set(key, edge.vertexIds)
  }
  const faceVertexPositions = new Map<string, Map<string, Point3D>>()
  for (const face of mesh.faces) {
    const netFace = net.faces.find((candidate) => candidate.id === face.id)!
    const transform = poseMap.get(face.id)!
    const center = faceCenter(netFace.polygon)
    faceVertexPositions.set(
      face.id,
      new Map(
        netFace.vertexIds.map((vertexId, index) => [
          vertexId,
          transformPoint(transform, {
            x: netFace.polygon[index].x - center.x,
            y: netFace.polygon[index].y - center.y,
            z: 0,
          }),
        ]),
      ),
    )
  }

  const intersections: FaceIntersection[] = []
  for (let firstIndex = 0; firstIndex < foldedFaces.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < foldedFaces.length;
      secondIndex += 1
    ) {
      const first = foldedFaces[firstIndex]
      const second = foldedFaces[secondIndex]
      const pairKey = [first.faceId, second.faceId].sort().join('|')
      const sharedEdge = edgeByFacePair.get(pairKey)
      let kind: FaceIntersection['kind'] | null = null
      const points: Point3D[] = []
      for (const firstTriangle of first.triangles) {
        for (const secondTriangle of second.triangles) {
          if (!aabbOverlaps(firstTriangle, secondTriangle, tolerance)) continue
          const hit = intersectTriangles3D(
            firstTriangle,
            secondTriangle,
            tolerance,
          )
          if (!hit) continue
          kind =
            kind === 'crossing' || hit.kind === 'crossing'
              ? 'crossing'
              : 'coplanar'
          points.push(...hit.points)
        }
      }
      const uniquePoints = points.filter(
        (point, index) =>
          points.findIndex((candidate) =>
            samePoint(candidate, point, tolerance * 2),
          ) === index,
      )
      let collisionPoints = uniquePoints
      if (sharedEdge) {
        const firstPositions = faceVertexPositions.get(first.faceId)!
        const edgeStart = firstPositions.get(sharedEdge[0])
        const edgeEnd = firstPositions.get(sharedEdge[1])
        if (edgeStart && edgeEnd) {
          collisionPoints = uniquePoints.filter(
            (point) =>
              segmentDistance(point, edgeStart, edgeEnd) > tolerance * 4,
          )
        }
      }
      if (collisionPoints.length && kind) {
        intersections.push({
          firstFaceId: first.faceId,
          secondFaceId: second.faceId,
          kind,
          points: collisionPoints,
        })
      }
    }
  }
  return intersections
}

function faceCenter(points: Point2D[]): Point2D {
  const sum = points.reduce(
    (center, point) => ({ x: center.x + point.x, y: center.y + point.y }),
    { x: 0, y: 0 },
  )
  return { x: sum.x / points.length, y: sum.y / points.length }
}
