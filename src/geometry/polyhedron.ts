import type {
  Point3D,
  PolyhedronEdge,
  PolyhedronFace,
  PolyhedronMesh,
  PolyhedronVertex,
  Vector3D,
} from './types'

export const POLYHEDRON_EPSILON = 1e-8

export type PolyhedronIssue =
  | { kind: 'duplicate-vertex'; vertexId: string }
  | { kind: 'duplicate-face'; faceId: string }
  | { kind: 'invalid-vertex'; vertexId: string; reason: string }
  | { kind: 'invalid-face'; faceId: string; reason: string }
  | { kind: 'degenerate-face'; faceId: string }
  | { kind: 'non-manifold-edge'; edgeId: string; faceIds: string[] }
  | { kind: 'inconsistent-winding'; edgeId: string; faceIds: string[] }
  | { kind: 'disconnected'; faceIds: string[] }
  | { kind: 'euler-characteristic'; value: number; expected: number }
  | { kind: 'inward-winding'; signedVolume: number }

export type PolyhedronAnalysis = {
  valid: boolean
  issues: PolyhedronIssue[]
  edges: PolyhedronEdge[]
  faceNormals: Map<string, Vector3D>
  eulerCharacteristic: number
  signedVolume: number
  orientation: 'outward' | 'inward' | 'degenerate'
}

type EdgeUse = { faceId: string; direction: 1 | -1 }

function edgeKey(a: string, b: string): string {
  return JSON.stringify(a < b ? [a, b] : [b, a])
}

/** Newell's method is stable for convex and concave planar polygon faces. */
export function calculateFaceNormal(
  points: Point3D[],
  tolerance = POLYHEDRON_EPSILON,
): Vector3D | null {
  if (points.length < 3) return null
  const sum = points.reduce(
    (normal, point, index) => {
      const next = points[(index + 1) % points.length]
      return {
        x: normal.x + (point.y - next.y) * (point.z + next.z),
        y: normal.y + (point.z - next.z) * (point.x + next.x),
        z: normal.z + (point.x - next.x) * (point.y + next.y),
      }
    },
    { x: 0, y: 0, z: 0 },
  )
  const magnitude = Math.hypot(sum.x, sum.y, sum.z)
  return magnitude <= tolerance
    ? null
    : { x: sum.x / magnitude, y: sum.y / magnitude, z: sum.z / magnitude }
}

function signedMeshVolume(
  faces: PolyhedronFace[],
  vertices: Map<string, PolyhedronVertex>,
): number {
  let volume = 0
  for (const face of faces) {
    const first = vertices.get(face.vertexIds[0])?.position
    if (!first) continue
    for (let index = 1; index < face.vertexIds.length - 1; index += 1) {
      const second = vertices.get(face.vertexIds[index])?.position
      const third = vertices.get(face.vertexIds[index + 1])?.position
      if (!second || !third) continue
      volume +=
        first.x * (second.y * third.z - second.z * third.y) +
        first.y * (second.z * third.x - second.x * third.z) +
        first.z * (second.x * third.y - second.y * third.x)
    }
  }
  return volume / 6
}

/**
 * Derives undirected edges and checks a closed, connected, outward-oriented
 * genus-zero polyhedral surface. It does not mutate the supplied mesh.
 */
export function analyzePolyhedron(
  mesh: PolyhedronMesh,
  tolerance = POLYHEDRON_EPSILON,
): PolyhedronAnalysis {
  const issues: PolyhedronIssue[] = []
  const vertexMap = new Map<string, PolyhedronVertex>()
  for (const vertex of mesh.vertices) {
    if (vertexMap.has(vertex.id))
      issues.push({ kind: 'duplicate-vertex', vertexId: vertex.id })
    if (
      !vertex.id ||
      ![vertex.position.x, vertex.position.y, vertex.position.z].every(
        Number.isFinite,
      )
    ) {
      issues.push({
        kind: 'invalid-vertex',
        vertexId: vertex.id,
        reason: 'ID and coordinates must be valid and finite.',
      })
    }
    vertexMap.set(vertex.id, vertex)
  }

  const faceIds = new Set<string>()
  const edgeUses = new Map<string, EdgeUse[]>()
  const faceNormals = new Map<string, Vector3D>()
  const faceAdjacency = new Map<string, Set<string>>()
  for (const face of mesh.faces) {
    if (faceIds.has(face.id))
      issues.push({ kind: 'duplicate-face', faceId: face.id })
    faceIds.add(face.id)
    faceAdjacency.set(face.id, new Set())
    if (
      !face.id ||
      face.vertexIds.length < 3 ||
      new Set(face.vertexIds).size !== face.vertexIds.length
    ) {
      issues.push({
        kind: 'invalid-face',
        faceId: face.id,
        reason:
          'A face needs a unique ID and at least three distinct vertices.',
      })
      continue
    }
    const points = face.vertexIds.map((id) => vertexMap.get(id)?.position)
    if (points.some((point) => !point)) {
      issues.push({
        kind: 'invalid-face',
        faceId: face.id,
        reason: 'Face references a missing vertex.',
      })
      continue
    }
    const validPoints = points as Point3D[]
    const normal = calculateFaceNormal(validPoints, tolerance)
    if (!normal) issues.push({ kind: 'degenerate-face', faceId: face.id })
    else faceNormals.set(face.id, normal)

    face.vertexIds.forEach((startId, index) => {
      const endId = face.vertexIds[(index + 1) % face.vertexIds.length]
      const key = edgeKey(startId, endId)
      const uses = edgeUses.get(key) ?? []
      uses.push({ faceId: face.id, direction: startId < endId ? 1 : -1 })
      edgeUses.set(key, uses)
    })
  }

  const edges: PolyhedronEdge[] = [...edgeUses].map(([key, uses], index) => {
    const vertexIds = JSON.parse(key) as [string, string]
    if (uses.length !== 2) {
      issues.push({
        kind: 'non-manifold-edge',
        edgeId: `edge-${index + 1}`,
        faceIds: uses.map((use) => use.faceId),
      })
    } else {
      faceAdjacency.get(uses[0].faceId)?.add(uses[1].faceId)
      faceAdjacency.get(uses[1].faceId)?.add(uses[0].faceId)
      if (uses[0].direction === uses[1].direction) {
        issues.push({
          kind: 'inconsistent-winding',
          edgeId: `edge-${index + 1}`,
          faceIds: uses.map((use) => use.faceId),
        })
      }
    }
    return {
      id: `edge-${index + 1}`,
      vertexIds,
      adjacentFaceIds: uses.map((use) => use.faceId),
    }
  })

  const reached = new Set<string>()
  const queue = mesh.faces.length ? [mesh.faces[0].id] : []
  while (queue.length) {
    const id = queue.shift()!
    if (reached.has(id)) continue
    reached.add(id)
    queue.push(...(faceAdjacency.get(id) ?? []))
  }
  const disconnected = mesh.faces
    .map((face) => face.id)
    .filter((id) => !reached.has(id))
  if (disconnected.length)
    issues.push({ kind: 'disconnected', faceIds: disconnected })

  const eulerCharacteristic =
    mesh.vertices.length - edges.length + mesh.faces.length
  if (eulerCharacteristic !== 2) {
    issues.push({
      kind: 'euler-characteristic',
      value: eulerCharacteristic,
      expected: 2,
    })
  }
  const signedVolume = signedMeshVolume(mesh.faces, vertexMap)
  const orientation =
    Math.abs(signedVolume) <= tolerance
      ? 'degenerate'
      : signedVolume > 0
        ? 'outward'
        : 'inward'
  if (orientation === 'inward')
    issues.push({ kind: 'inward-winding', signedVolume })

  return {
    valid: issues.length === 0,
    issues,
    edges,
    faceNormals,
    eulerCharacteristic,
    signedVolume,
    orientation,
  }
}
