import { composeTransforms, quaternionFromAxisAngle, subtract } from './math'
import type {
  FoldGraph,
  FoldGraphError,
  FoldHinge,
  FoldPose,
  FoldPoint,
  RigidTransform,
} from './types'

function validateGraph(graph: FoldGraph): FoldGraphError[] {
  const errors: FoldGraphError[] = []
  const faces = new Map<string, FoldPoint>()
  for (const face of graph.faces) {
    if (faces.has(face.id))
      errors.push({ kind: 'duplicate-face', faceId: face.id })
    if (![face.center.x, face.center.y, face.center.z].every(Number.isFinite)) {
      errors.push({
        kind: 'invalid-face',
        faceId: face.id,
        reason: 'Center coordinates must be finite.',
      })
    }
    faces.set(face.id, face.center)
  }
  if (!faces.has(graph.rootFaceId))
    errors.push({ kind: 'missing-root', faceId: graph.rootFaceId })

  const parents = new Set<string>()
  const adjacency = new Map([...faces.keys()].map((id) => [id, [] as string[]]))
  for (const hinge of graph.hinges) {
    const reason = hingeError(hinge, faces, parents)
    if (reason)
      errors.push({ kind: 'invalid-hinge', hingeId: hinge.id, reason })
    if (hinge.childFaceId === graph.rootFaceId) {
      errors.push({
        kind: 'invalid-hinge',
        hingeId: hinge.id,
        reason: 'The root face cannot have a parent.',
      })
    }
    if (!adjacency.has(hinge.parentFaceId) || !adjacency.has(hinge.childFaceId))
      continue
    adjacency.get(hinge.parentFaceId)?.push(hinge.childFaceId)
    adjacency.get(hinge.childFaceId)?.push(hinge.parentFaceId)
  }

  const reached = new Set<string>()
  const queue = faces.has(graph.rootFaceId) ? [graph.rootFaceId] : []
  while (queue.length) {
    const id = queue.shift()!
    if (reached.has(id)) continue
    reached.add(id)
    queue.push(...(adjacency.get(id) ?? []))
  }
  const disconnected = [...faces.keys()].filter((id) => !reached.has(id))
  if (disconnected.length)
    errors.push({ kind: 'disconnected', faceIds: disconnected })
  return errors
}

function hingeError(
  hinge: FoldHinge,
  faces: Map<string, FoldPoint>,
  parents: Set<string>,
): string | null {
  if (!faces.has(hinge.parentFaceId) || !faces.has(hinge.childFaceId))
    return 'Both hinge faces must exist.'
  if (hinge.parentFaceId === hinge.childFaceId)
    return 'A hinge cannot connect a face to itself.'
  if (parents.has(hinge.childFaceId))
    return 'A face may have only one parent in the fold tree.'
  parents.add(hinge.childFaceId)
  if (!Number.isFinite(hinge.angleRadians)) return 'Hinge angle must be finite.'
  if (
    ![
      hinge.start.x,
      hinge.start.y,
      hinge.start.z,
      hinge.end.x,
      hinge.end.y,
      hinge.end.z,
    ].every(Number.isFinite)
  ) {
    return 'Hinge coordinates must be finite.'
  }
  if (
    Math.hypot(
      hinge.end.x - hinge.start.x,
      hinge.end.y - hinge.start.y,
      hinge.end.z - hinge.start.z,
    ) < 1e-9
  )
    return 'Hinge axis must have non-zero length.'
  return null
}

/** Validates the tree and returns one pose per face. Progress is clamped to [0, 1]. */
export function solveFoldPoses(
  graph: FoldGraph,
  progress: number,
  hingeProgressById?: Readonly<Record<string, number>>,
): FoldPose[] {
  const errors = validateGraph(graph)
  if (errors.length)
    throw new RangeError(errors.map((error) => error.kind).join(', '))
  if (!Number.isFinite(progress))
    throw new RangeError('Fold progress must be finite.')

  const t = Math.min(1, Math.max(0, progress))
  const faces = new Map(graph.faces.map((face) => [face.id, face]))
  const children = new Map<string, FoldHinge[]>()
  for (const hinge of graph.hinges) {
    const hinges = children.get(hinge.parentFaceId) ?? []
    hinges.push(hinge)
    children.set(hinge.parentFaceId, hinges)
  }
  const poses = new Map<string, RigidTransform>()
  const root = faces.get(graph.rootFaceId)!
  poses.set(root.id, {
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    translation: root.center,
  })
  const visit = (parentId: string) => {
    const parentPose = poses.get(parentId)!
    const parent = faces.get(parentId)!
    for (const hinge of children.get(parentId) ?? []) {
      const child = faces.get(hinge.childFaceId)!
      const axis = subtract(hinge.end, hinge.start)
      const hingeProgress = hingeProgressById?.[hinge.id]
      if (hingeProgress !== undefined && !Number.isFinite(hingeProgress)) {
        throw new RangeError('Hinge progress must be finite.')
      }
      const hingeT =
        hingeProgress === undefined
          ? t
          : Math.min(1, Math.max(0, hingeProgress))
      const rotation = quaternionFromAxisAngle(
        axis,
        hinge.angleRadians * hingeT,
      )
      const local: RigidTransform = {
        rotation,
        translation: subtract(hinge.start, parent.center),
      }
      const rotatedOffset: RigidTransform = {
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        translation: subtract(child.center, hinge.start),
      }
      const pose = composeTransforms(
        composeTransforms(parentPose, local),
        rotatedOffset,
      )
      poses.set(child.id, pose)
      visit(child.id)
    }
  }
  visit(root.id)
  return graph.faces.map((face) => ({
    faceId: face.id,
    transform: poses.get(face.id)!,
  }))
}
