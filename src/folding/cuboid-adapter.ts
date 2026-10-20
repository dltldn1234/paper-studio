import type { Cuboid, FaceId, NetLayout } from '../geometry'
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

const FOLD_TOLERANCE = 1e-7

function faceFrame(cuboid: Cuboid, faceId: FaceId): Quaternion {
  const face = cuboid.faces.find((candidate) => candidate.id === faceId)
  if (!face || face.vertices.length < 3)
    throw new RangeError(`Missing face geometry: ${faceId}`)
  const xAxis = normalize(subtract(face.vertices[1], face.vertices[0]))
  const yAxis = normalize(subtract(face.vertices[2], face.vertices[1]))
  return quaternionFromBasis(xAxis, yAxis, cross(xAxis, yAxis))
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
  if (residual > FOLD_TOLERANCE) {
    throw new RangeError(
      'Adjacent target faces do not share a single hinge rotation.',
    )
  }
  let angle = 2 * Math.atan2(projected, relative.w)
  if (angle > Math.PI) angle -= 2 * Math.PI
  if (angle < -Math.PI) angle += 2 * Math.PI
  return Math.abs(angle) < FOLD_TOLERANCE ? 0 : angle
}

/** Builds a hinge tree from the cuboid net and derives each angle from its target face frames. */
export function createCuboidFoldGraph(
  net: NetLayout,
  cuboid: Cuboid,
): FoldGraph {
  const netFaces = new Map(net.faces.map((face) => [face.id, face]))
  const targetFrames = new Map(
    cuboid.faces.map((face) => [face.id, faceFrame(cuboid, face.id)]),
  )
  const faces = net.faces.map((face) => ({
    id: face.id,
    center: {
      x: face.origin.x + face.widthMm / 2,
      y: face.origin.y + face.heightMm / 2,
      z: 0,
    },
  }))
  const rootFaceId: FaceId = 'front'
  const visited = new Set<FaceId>([rootFaceId])
  const hinges: FoldHinge[] = []
  const queue: FaceId[] = [rootFaceId]
  while (queue.length) {
    const parentId = queue.shift()!
    for (const edge of net.edges) {
      if (edge.kind !== 'fold' || !edge.adjacentFaceIds.includes(parentId))
        continue
      const childId = edge.adjacentFaceIds.find((id) => id !== parentId)
      if (!childId || visited.has(childId)) continue
      const parent = netFaces.get(parentId)
      const child = netFaces.get(childId)
      const parentFrame = targetFrames.get(parentId)
      const childFrame = targetFrames.get(childId)
      if (!parent || !child || !parentFrame || !childFrame) {
        throw new RangeError(
          `Invalid net hinge ${edge.id}: face geometry is missing.`,
        )
      }
      const direction = normalize({
        x: edge.end.x - edge.start.x,
        y: edge.end.y - edge.start.y,
        z: 0,
      })
      const angleRadians = signedHingeAngle(parentFrame, childFrame, direction)
      hinges.push({
        id: edge.id,
        parentFaceId: parentId,
        childFaceId: childId,
        start: { ...edge.start, z: 0 },
        end: { ...edge.end, z: 0 },
        angleRadians,
      })
      visited.add(childId)
      queue.push(childId)
    }
  }
  if (visited.size !== faces.length) {
    const missing = faces
      .filter((face) => !visited.has(face.id as FaceId))
      .map((face) => face.id)
    throw new RangeError(`Cuboid net is disconnected: ${missing.join(', ')}`)
  }
  return { rootFaceId, faces, hinges }
}
