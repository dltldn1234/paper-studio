import { analyzePolyhedron, calculateFaceNormal } from './polyhedron'
import type {
  Point2D,
  PolyhedronEdge,
  PolyhedronFace,
  PolyhedronMesh,
} from './types'

export const UNFOLDING_EPSILON_MM = 1e-7
export const DEFAULT_UNFOLDING_SEARCH_LIMIT = 256

export type UnfoldedFace = {
  id: string
  label: string
  vertexIds: string[]
  polygon: Point2D[]
}
export type UnfoldedEdge = {
  id: string
  vertexIds: [string, string]
  adjacentFaceIds: string[]
  kind: 'cut' | 'fold'
  start: Point2D
  end: Point2D
}
export type UnfoldedNet = {
  faces: UnfoldedFace[]
  edges: UnfoldedEdge[]
  bounds: { x: number; y: number; width: number; height: number }
  foldEdgeIds: string[]
}
export type UnfoldingOptions = {
  rootFaceId?: string
  maxCandidates?: number
  toleranceMm?: number
  /** Use this exact set of shared edges instead of searching for a tree. */
  foldEdgeIds?: string[]
}
export type UnfoldingResult =
  | { success: true; layout: UnfoldedNet; candidatesTried: number }
  | {
      success: false
      reason:
        | 'invalid-mesh'
        | 'invalid-fold-tree'
        | 'no-non-overlapping-net'
        | 'search-limit'
      issues: string[]
      candidatesTried: number
      collisions: Array<{ firstFaceId: string; secondFaceId: string }>
    }

type Edge = PolyhedronEdge
type PointMap = Map<string, Point2D>
type ParentLink = { edgeId: string; parentFaceId: string; childFaceId: string }
type FacePair = { firstFaceId: string; secondFaceId: string }

function subtract3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}
function dot3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}
function cross3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}
function scale3(a: { x: number; y: number; z: number }, amount: number) {
  return { x: a.x * amount, y: a.y * amount, z: a.z * amount }
}
function length3(a: { x: number; y: number; z: number }) {
  return Math.hypot(a.x, a.y, a.z)
}
function unit3(a: { x: number; y: number; z: number }) {
  const magnitude = Math.hypot(a.x, a.y, a.z)
  return scale3(a, 1 / magnitude)
}
function projectFace(
  face: PolyhedronFace,
  vertices: Map<string, { x: number; y: number; z: number }>,
): PointMap | null {
  const points = face.vertexIds.map((id) => vertices.get(id))
  if (points.some((point) => !point) || points.length < 3) return null
  const positions = points as Array<{ x: number; y: number; z: number }>
  const normal = calculateFaceNormal(positions)
  if (!normal) return null
  const origin = positions[0]
  const xAxis = unit3(subtract3(positions[1], origin))
  const yAxis = cross3(normal, xAxis)
  const scale = Math.max(
    ...positions.map((point) => length3(subtract3(point, origin))),
  )
  if (
    positions.some(
      (point) =>
        Math.abs(dot3(subtract3(point, origin), normal)) >
        Math.max(UNFOLDING_EPSILON_MM, scale * 1e-9),
    )
  ) {
    return null
  }
  return new Map(
    face.vertexIds.map((id, index) => {
      const relative = subtract3(positions[index], origin)
      return [id, { x: dot3(relative, xAxis), y: dot3(relative, yAxis) }]
    }),
  )
}

function placeChild(
  face: PolyhedronFace,
  local: PointMap,
  parentPoints: PointMap,
  edge: Edge,
): PointMap | null {
  const [startId, endId] = edge.vertexIds
  const localStart = local.get(startId)
  const localEnd = local.get(endId)
  const targetStart = parentPoints.get(startId)
  const targetEnd = parentPoints.get(endId)
  if (!localStart || !localEnd || !targetStart || !targetEnd) return null
  const localAngle = Math.atan2(
    localEnd.y - localStart.y,
    localEnd.x - localStart.x,
  )
  const targetAngle = Math.atan2(
    targetEnd.y - targetStart.y,
    targetEnd.x - targetStart.x,
  )
  const angle = targetAngle - localAngle
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const mapped = new Map<string, Point2D>()
  for (const [id, point] of local) {
    const dx = point.x - localStart.x
    const dy = point.y - localStart.y
    mapped.set(id, {
      x: targetStart.x + dx * cosine - dy * sine,
      y: targetStart.y + dx * sine + dy * cosine,
    })
  }
  return face.vertexIds.every((id) => mapped.has(id)) ? mapped : null
}

function overlapOnAxis(
  first: Point2D[],
  second: Point2D[],
  tolerance: number,
): boolean {
  for (const polygon of [first, second]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]
      const end = polygon[(index + 1) % polygon.length]
      const axisX = -(end.y - start.y)
      const axisY = end.x - start.x
      const axisLength = Math.hypot(axisX, axisY)
      if (axisLength <= tolerance) continue
      const project = (point: Point2D) =>
        (point.x * axisX + point.y * axisY) / axisLength
      const firstValues = first.map(project)
      const secondValues = second.map(project)
      const overlap =
        Math.min(Math.max(...firstValues), Math.max(...secondValues)) -
        Math.max(Math.min(...firstValues), Math.min(...secondValues))
      if (overlap <= tolerance) return false
    }
  }
  return true
}

export function findUnfoldedFaceOverlaps(
  faces: Array<Pick<UnfoldedFace, 'id' | 'polygon'>>,
  tolerance = UNFOLDING_EPSILON_MM,
) {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError(
      'Overlap tolerance must be a finite non-negative number.',
    )
  }
  const collisions: Array<{ firstFaceId: string; secondFaceId: string }> = []
  for (let first = 0; first < faces.length; first += 1) {
    for (let second = first + 1; second < faces.length; second += 1) {
      if (
        overlapOnAxis(faces[first].polygon, faces[second].polygon, tolerance)
      ) {
        collisions.push({
          firstFaceId: faces[first].id,
          secondFaceId: faces[second].id,
        })
      }
    }
  }
  return collisions
}

function isConvex(polygon: Point2D[], tolerance: number): boolean {
  let direction = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const first = polygon[index]
    const second = polygon[(index + 1) % polygon.length]
    const third = polygon[(index + 2) % polygon.length]
    const cross =
      (second.x - first.x) * (third.y - second.y) -
      (second.y - first.y) * (third.x - second.x)
    if (Math.abs(cross) <= tolerance) continue
    const sign = Math.sign(cross)
    if (direction && sign !== direction) return false
    direction = sign
  }
  return direction !== 0
}

function makeLayout(
  mesh: PolyhedronMesh,
  edgeMap: Map<string, Edge>,
  placed: Map<string, PointMap>,
  treeEdgeIds: Set<string>,
  tolerance: number,
): { layout: UnfoldedNet | null; collisions: FacePair[] } {
  const faces = mesh.faces.map((face) => {
    const points = placed.get(face.id)
    if (!points) return null
    return {
      id: face.id,
      label: face.label ?? face.id,
      vertexIds: [...face.vertexIds],
      polygon: face.vertexIds.map((id) => points.get(id)!),
    }
  })
  if (faces.some((face) => !face)) return { layout: null, collisions: [] }
  const validFaces = faces as UnfoldedFace[]
  const collisions = findUnfoldedFaceOverlaps(validFaces, tolerance)
  if (collisions.length) return { layout: null, collisions }

  const edges = [...edgeMap.values()].map((edge) => {
    const owner = edge.adjacentFaceIds[0]
    const points = placed.get(owner)!
    return {
      id: edge.id,
      vertexIds: edge.vertexIds,
      adjacentFaceIds: edge.adjacentFaceIds,
      kind: treeEdgeIds.has(edge.id) ? ('fold' as const) : ('cut' as const),
      start: points.get(edge.vertexIds[0])!,
      end: points.get(edge.vertexIds[1])!,
    }
  })
  const allPoints = validFaces.flatMap((face) => face.polygon)
  const minX = Math.min(...allPoints.map((point) => point.x))
  const minY = Math.min(...allPoints.map((point) => point.y))
  const maxX = Math.max(...allPoints.map((point) => point.x))
  const maxY = Math.max(...allPoints.map((point) => point.y))
  return {
    layout: {
      faces: validFaces,
      edges,
      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      foldEdgeIds: edges
        .filter((edge) => edge.kind === 'fold')
        .map((edge) => edge.id),
    },
    collisions: [],
  }
}

function unfoldTree(
  mesh: PolyhedronMesh,
  edgeMap: Map<string, Edge>,
  faceMap: Map<string, PolyhedronFace>,
  rootId: string,
  links: ParentLink[],
  tolerance: number,
): { layout: UnfoldedNet | null; collisions: FacePair[] } {
  const vertexMap = new Map(
    mesh.vertices.map((vertex) => [vertex.id, vertex.position]),
  )
  const local = new Map<string, PointMap>()
  for (const face of mesh.faces) {
    const projection = projectFace(face, vertexMap)
    if (!projection) return { layout: null, collisions: [] }
    local.set(face.id, projection)
  }
  const root = faceMap.get(rootId)
  const rootPoints = root ? local.get(rootId) : null
  if (!root || !rootPoints) return { layout: null, collisions: [] }
  const placed = new Map<string, PointMap>([[rootId, rootPoints]])
  const pending = [...links]
  while (pending.length) {
    const index = pending.findIndex((link) => placed.has(link.parentFaceId))
    if (index < 0) return { layout: null, collisions: [] }
    const [link] = pending.splice(index, 1)
    const edge = edgeMap.get(link.edgeId)
    const child = faceMap.get(link.childFaceId)
    if (!edge || !child) return { layout: null, collisions: [] }
    const points = placeChild(
      child,
      local.get(child.id)!,
      placed.get(link.parentFaceId)!,
      edge,
    )
    if (!points) return { layout: null, collisions: [] }
    placed.set(child.id, points)
  }
  return makeLayout(
    mesh,
    edgeMap,
    placed,
    new Set(links.map((link) => link.edgeId)),
    tolerance,
  )
}

/**
 * Search deterministic spanning-tree candidates and unfold each face rigidly
 * around its shared 3D edge. The overlap test assumes convex planar faces.
 */
export function unfoldPolyhedron(
  mesh: PolyhedronMesh,
  options: UnfoldingOptions = {},
): UnfoldingResult {
  const analysis = analyzePolyhedron(mesh)
  if (!analysis.valid) {
    return {
      success: false,
      reason: 'invalid-mesh',
      issues: analysis.issues.map((issue) => issue.kind),
      candidatesTried: 0,
      collisions: [],
    }
  }
  const maxCandidates = options.maxCandidates ?? DEFAULT_UNFOLDING_SEARCH_LIMIT
  const tolerance = options.toleranceMm ?? UNFOLDING_EPSILON_MM
  if (
    !Number.isInteger(maxCandidates) ||
    maxCandidates < 1 ||
    !Number.isFinite(tolerance) ||
    tolerance <= 0
  ) {
    return {
      success: false,
      reason: 'invalid-mesh',
      issues: ['invalid-search-options'],
      candidatesTried: 0,
      collisions: [],
    }
  }
  const faceMap = new Map(mesh.faces.map((face) => [face.id, face]))
  const vertexMap = new Map(
    mesh.vertices.map((vertex) => [vertex.id, vertex.position]),
  )
  const projections = mesh.faces.map((face) => projectFace(face, vertexMap))
  if (projections.some((projection) => !projection)) {
    return {
      success: false,
      reason: 'invalid-mesh',
      issues: ['face-is-non-planar-or-degenerate'],
      candidatesTried: 0,
      collisions: [],
    }
  }
  if (
    mesh.faces.some(
      (face, index) =>
        !isConvex(
          face.vertexIds.map((id) => projections[index]!.get(id)!),
          tolerance,
        ),
    )
  ) {
    return {
      success: false,
      reason: 'invalid-mesh',
      issues: ['non-convex-face-is-not-supported'],
      candidatesTried: 0,
      collisions: [],
    }
  }
  const rootId = options.rootFaceId ?? mesh.faces[0]?.id
  if (!rootId || !faceMap.has(rootId)) {
    return {
      success: false,
      reason: 'invalid-mesh',
      issues: ['missing-root-face'],
      candidatesTried: 0,
      collisions: [],
    }
  }
  const edgeMap = new Map<string, Edge>()
  for (const edge of analysis.edges) {
    edgeMap.set(edge.id, edge)
  }

  if (options.foldEdgeIds) {
    const requested = options.foldEdgeIds
    const uniqueIds = new Set(requested)
    const invalidIds = requested.filter((id) => {
      const edge = edgeMap.get(id)
      return !edge || edge.adjacentFaceIds.length !== 2
    })
    const issues: string[] = []
    if (uniqueIds.size !== requested.length) issues.push('duplicate-fold-edge')
    if (invalidIds.length) issues.push('unknown-or-boundary-fold-edge')
    if (requested.length !== mesh.faces.length - 1) {
      issues.push('fold-edge-count-must-equal-face-count-minus-one')
    }
    if (issues.length) {
      return {
        success: false,
        reason: 'invalid-fold-tree',
        issues,
        candidatesTried: 0,
        collisions: [],
      }
    }

    const adjacency = new Map<string, ParentLink[]>()
    for (const edgeId of requested) {
      const edge = edgeMap.get(edgeId)!
      const [firstFaceId, secondFaceId] = edge.adjacentFaceIds
      adjacency.set(firstFaceId, [
        ...(adjacency.get(firstFaceId) ?? []),
        { edgeId, parentFaceId: firstFaceId, childFaceId: secondFaceId },
      ])
      adjacency.set(secondFaceId, [
        ...(adjacency.get(secondFaceId) ?? []),
        { edgeId, parentFaceId: secondFaceId, childFaceId: firstFaceId },
      ])
    }
    const reached = new Set([rootId])
    const links: ParentLink[] = []
    const queue = [rootId]
    while (queue.length) {
      const parentFaceId = queue.shift()!
      for (const link of adjacency.get(parentFaceId) ?? []) {
        if (reached.has(link.childFaceId)) continue
        reached.add(link.childFaceId)
        links.push(link)
        queue.push(link.childFaceId)
      }
    }
    if (reached.size !== mesh.faces.length) {
      return {
        success: false,
        reason: 'invalid-fold-tree',
        issues: ['fold-edges-do-not-connect-all-faces'],
        candidatesTried: 0,
        collisions: [],
      }
    }
    const attempt = unfoldTree(mesh, edgeMap, faceMap, rootId, links, tolerance)
    if (attempt.layout) {
      return { success: true, layout: attempt.layout, candidatesTried: 1 }
    }
    return {
      success: false,
      reason: 'no-non-overlapping-net',
      issues: attempt.collisions.length
        ? ['selected-fold-tree-overlaps']
        : ['selected-fold-tree-could-not-be-unfolded'],
      candidatesTried: 1,
      collisions: attempt.collisions,
    }
  }

  let candidatesTried = 0
  let exhausted = false
  let collisions: FacePair[] = []
  const visitedStates = new Set<string>()
  const visit = (
    reached: Set<string>,
    links: ParentLink[],
  ): UnfoldedNet | null => {
    if (reached.size === mesh.faces.length) {
      if (candidatesTried >= maxCandidates) {
        exhausted = true
        return null
      }
      candidatesTried += 1
      const attempt = unfoldTree(
        mesh,
        edgeMap,
        faceMap,
        rootId,
        links,
        tolerance,
      )
      if (attempt.collisions.length) collisions = attempt.collisions
      return attempt.layout
    }
    const stateKey = [...links.map((link) => link.edgeId)].sort().join(',')
    if (visitedStates.has(stateKey)) return null
    visitedStates.add(stateKey)
    const frontier = [...edgeMap.values()]
      .filter((edge) => edge.adjacentFaceIds.length === 2)
      .flatMap((edge) => {
        const [first, second] = edge.adjacentFaceIds
        if (reached.has(first) === reached.has(second)) return []
        const parentFaceId = reached.has(first) ? first : second
        const childFaceId = reached.has(first) ? second : first
        return [{ edgeId: edge.id, parentFaceId, childFaceId }]
      })
      .sort((a, b) => a.edgeId.localeCompare(b.edgeId))
    for (const link of frontier) {
      const nextReached = new Set(reached).add(link.childFaceId)
      const result = visit(nextReached, [...links, link])
      if (result) return result
      if (exhausted) return null
    }
    return null
  }

  // Run a first candidate separately so failed overlap pairs can be reported.
  const result = visit(new Set([rootId]), [])
  if (result) return { success: true, layout: result, candidatesTried }
  return {
    success: false,
    reason: exhausted ? 'search-limit' : 'no-non-overlapping-net',
    issues: [
      exhausted
        ? 'candidate-search-limit-reached'
        : 'all-candidate-nets-overlap',
    ],
    candidatesTried,
    collisions,
  }
}
