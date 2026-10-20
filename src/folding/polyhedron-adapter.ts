import { analyzePolyhedron } from '../geometry/polyhedron'
import type { PolyhedronMesh } from '../geometry/types'
import type { UnfoldedNet } from '../geometry/unfolding'
import {
  cross,
  dot,
  inverseQuaternion,
  length,
  normalize,
  quaternionFromBasis,
  multiplyQuaternions,
  subtract,
} from './math'
import type { FoldGraph, FoldHinge, FoldPoint, Quaternion } from './types'

export const POLYHEDRON_FOLD_TOLERANCE = 1e-7

function targetFrame(
  mesh: PolyhedronMesh,
  net: UnfoldedNet,
  faceId: string,
  normals: Map<string, { x: number; y: number; z: number }>,
): Quaternion {
  const face = mesh.faces.find((candidate) => candidate.id === faceId)
  const netFace = net.faces.find((candidate) => candidate.id === faceId)
  const normal = normals.get(faceId)
  if (!face || !netFace || !normal || face.vertexIds.length < 3) {
    throw new RangeError(`Missing face frame data: ${faceId}`)
  }
  const positions = new Map(
    mesh.vertices.map((vertex) => [vertex.id, vertex.position]),
  )
  const netPoints = new Map(
    netFace.vertexIds.map((id, index) => [id, netFace.polygon[index]]),
  )
  const firstId = face.vertexIds[0]
  const secondId = face.vertexIds[1]
  const worldStart = positions.get(firstId)
  const worldEnd = positions.get(secondId)
  const netStart = netPoints.get(firstId)
  const netEnd = netPoints.get(secondId)
  if (!worldStart || !worldEnd || !netStart || !netEnd) {
    throw new RangeError(
      `Face ${faceId} has an incomplete vertex correspondence.`,
    )
  }
  const targetX = normalize(subtract(worldEnd, worldStart))
  const targetY = normalize(cross(normal, targetX))
  const netX = normalize({
    x: netEnd.x - netStart.x,
    y: netEnd.y - netStart.y,
    z: 0,
  })
  const globalX = {
    x: targetX.x * netX.x - targetY.x * netX.y,
    y: targetX.y * netX.x - targetY.y * netX.y,
    z: targetX.z * netX.x - targetY.z * netX.y,
  }
  const globalY = {
    x: targetX.x * netX.y + targetY.x * netX.x,
    y: targetX.y * netX.y + targetY.y * netX.x,
    z: targetX.z * netX.y + targetY.z * netX.x,
  }
  return quaternionFromBasis(globalX, globalY, normal)
}

function signedHingeAngle(
  parent: Quaternion,
  child: Quaternion,
  axis: FoldPoint,
): number {
  const relative = multiplyQuaternions(inverseQuaternion(parent), child)
  const vector = { x: relative.x, y: relative.y, z: relative.z }
  const projected = dot(vector, axis)
  const residual = length(
    subtract(vector, {
      x: axis.x * projected,
      y: axis.y * projected,
      z: axis.z * projected,
    }),
  )
  if (residual > POLYHEDRON_FOLD_TOLERANCE) {
    throw new RangeError(
      'Adjacent target faces do not share one hinge rotation.',
    )
  }
  let angle = 2 * Math.atan2(projected, relative.w)
  if (angle > Math.PI) angle -= 2 * Math.PI
  if (angle < -Math.PI) angle += 2 * Math.PI
  return Math.abs(angle) < POLYHEDRON_FOLD_TOLERANCE ? 0 : angle
}

function faceCenter(netFace: UnfoldedNet['faces'][number]): FoldPoint {
  const sum = netFace.polygon.reduce(
    (center, point) => ({ x: center.x + point.x, y: center.y + point.y }),
    { x: 0, y: 0 },
  )
  return {
    x: sum.x / netFace.polygon.length,
    y: sum.y / netFace.polygon.length,
    z: 0,
  }
}

/** Builds a geometry-derived fold tree for any supported convex polyhedron net. */
export function createPolyhedronFoldGraph(
  net: UnfoldedNet,
  mesh: PolyhedronMesh,
  rootFaceId = net.faces[0]?.id,
): FoldGraph {
  const analysis = analyzePolyhedron(mesh)
  if (!analysis.valid) {
    throw new RangeError(
      `Invalid polyhedron topology: ${analysis.issues.map((issue) => issue.kind).join(', ')}`,
    )
  }
  const meshFaceIds = new Set(mesh.faces.map((face) => face.id))
  const netFaceIds = new Set(net.faces.map((face) => face.id))
  if (
    !rootFaceId ||
    !meshFaceIds.has(rootFaceId) ||
    meshFaceIds.size !== netFaceIds.size ||
    [...meshFaceIds].some((id) => !netFaceIds.has(id))
  ) {
    throw new RangeError(
      'The net must contain exactly the mesh faces and a valid root face.',
    )
  }
  const targetFrames = new Map(
    net.faces.map((face) => [
      face.id,
      targetFrame(mesh, net, face.id, analysis.faceNormals),
    ]),
  )
  const faces = net.faces.map((face) => ({
    id: face.id,
    center: faceCenter(face),
  }))
  const hinges: FoldHinge[] = []
  const visited = new Set([rootFaceId])
  const queue = [rootFaceId]
  while (queue.length) {
    const parentFaceId = queue.shift()!
    for (const edge of net.edges) {
      if (
        edge.kind !== 'fold' ||
        edge.adjacentFaceIds.length !== 2 ||
        !edge.adjacentFaceIds.includes(parentFaceId)
      ) {
        continue
      }
      const childFaceId = edge.adjacentFaceIds.find(
        (id) => id !== parentFaceId,
      )!
      if (visited.has(childFaceId)) continue
      if (!netFaceIds.has(childFaceId)) {
        throw new RangeError(`Fold edge ${edge.id} references an unknown face.`)
      }
      const axis = normalize({
        x: edge.end.x - edge.start.x,
        y: edge.end.y - edge.start.y,
        z: 0,
      })
      hinges.push({
        id: edge.id,
        parentFaceId,
        childFaceId,
        start: { ...edge.start, z: 0 },
        end: { ...edge.end, z: 0 },
        angleRadians: signedHingeAngle(
          targetFrames.get(parentFaceId)!,
          targetFrames.get(childFaceId)!,
          axis,
        ),
      })
      visited.add(childFaceId)
      queue.push(childFaceId)
    }
  }
  if (visited.size !== faces.length) {
    throw new RangeError(
      `Unfolded net is disconnected: ${faces
        .filter((face) => !visited.has(face.id))
        .map((face) => face.id)
        .join(', ')}`,
    )
  }
  if (hinges.length !== faces.length - 1) {
    throw new RangeError('Fold edges must form a spanning tree over all faces.')
  }
  return { rootFaceId, faces, hinges }
}
