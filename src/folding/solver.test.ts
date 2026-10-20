import { describe, expect, it } from 'vitest'
import { createCuboid, createCuboidNet } from '../geometry'
import { createCuboidFoldGraph } from './cuboid-adapter'
import {
  cross,
  inverseQuaternion,
  normalize,
  quaternionFromBasis,
  rotatePoint,
  subtract,
  transformPoint,
} from './math'
import { solveFoldPoses } from './solver'
import type { FoldGraph } from './types'

function graph(): FoldGraph {
  return {
    rootFaceId: 'base',
    faces: [
      { id: 'base', center: { x: 0, y: 0, z: 0 } },
      { id: 'side', center: { x: 0, y: 5, z: 0 } },
    ],
    hinges: [
      {
        id: 'hinge',
        parentFaceId: 'base',
        childFaceId: 'side',
        start: { x: -5, y: 0, z: 0 },
        end: { x: 5, y: 0, z: 0 },
        angleRadians: Math.PI / 2,
      },
    ],
  }
}

describe('solveFoldPoses', () => {
  it('keeps a connected face in its flat net position at zero progress', () => {
    const [base, side] = solveFoldPoses(graph(), 0)
    expect(base.transform.translation).toEqual({ x: 0, y: 0, z: 0 })
    expect(side.transform.translation).toEqual({ x: 0, y: 5, z: 0 })
    expect(side.transform.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 })
  })

  it('rotates the child around the shared edge and clamps progress', () => {
    const [base, side] = solveFoldPoses(graph(), 1.5)
    expect(base.transform.translation).toEqual({ x: 0, y: 0, z: 0 })
    expect(side.transform.translation.x).toBeCloseTo(0)
    expect(side.transform.translation.y).toBeCloseTo(0)
    expect(side.transform.translation.z).toBeCloseTo(5)
    expect(side.transform.rotation.x).toBeCloseTo(Math.SQRT1_2)
  })

  it('rejects disconnected face graphs', () => {
    const invalid = graph()
    invalid.hinges = []
    expect(() => solveFoldPoses(invalid, 0.5)).toThrow('disconnected')
  })

  it('rejects a zero length hinge axis', () => {
    const invalid = graph()
    invalid.hinges[0].end = invalid.hinges[0].start
    expect(() => solveFoldPoses(invalid, 0.5)).toThrow('invalid-hinge')
  })

  it.each([
    { widthMm: 100, depthMm: 80, heightMm: 60 },
    { widthMm: 12, depthMm: 34, heightMm: 56 },
    { widthMm: 500, depthMm: 250, heightMm: 120 },
  ])(
    'derives a closed cuboid fold for $widthMm × $depthMm × $heightMm mm',
    (dimensions) => {
      const cuboid = createCuboid(dimensions)
      const net = createCuboidNet(dimensions)
      const graph = createCuboidFoldGraph(net, cuboid)
      const poses = new Map(
        solveFoldPoses(graph, 1).map((pose) => [pose.faceId, pose.transform]),
      )
      expect(graph.hinges).toHaveLength(5)
      const rootFace = cuboid.faces.find((face) => face.id === 'front')!
      const rootNetFace = net.faces.find((face) => face.id === 'front')!
      const rootCorners = targetCorners(
        cuboid,
        rootNetFace.edgeNeighborIds,
        'front',
      )
      const rootX = normalize(subtract(rootCorners[1], rootCorners[0]))
      const rootY = normalize(subtract(rootCorners[3], rootCorners[0]))
      const rootRotation = quaternionFromBasis(
        rootX,
        rootY,
        cross(rootX, rootY),
      )
      const rootNetCenter = poses.get('front')!.translation
      for (const face of cuboid.faces) {
        const transform = poses.get(face.id)!
        const netFace = net.faces.find((candidate) => candidate.id === face.id)!
        const corners = targetCorners(cuboid, netFace.edgeNeighborIds, face.id)
        const localCorners = [
          { x: -netFace.widthMm / 2, y: -netFace.heightMm / 2, z: 0 },
          { x: netFace.widthMm / 2, y: -netFace.heightMm / 2, z: 0 },
          { x: netFace.widthMm / 2, y: netFace.heightMm / 2, z: 0 },
          { x: -netFace.widthMm / 2, y: netFace.heightMm / 2, z: 0 },
        ]
        localCorners.forEach((local, index) => {
          const actual = subtract(
            transformPoint(transform, local),
            rootNetCenter,
          )
          const expected = rotatePoint(
            inverseQuaternion(rootRotation),
            subtract(corners[index], rootFace.center),
          )
          expect(actual.x, `${face.id} corner ${index} x`).toBeCloseTo(
            expected.x,
            6,
          )
          expect(actual.y, `${face.id} corner ${index} y`).toBeCloseTo(
            expected.y,
            6,
          )
          expect(actual.z, `${face.id} corner ${index} z`).toBeCloseTo(
            expected.z,
            6,
          )
        })
      }
    },
  )
})

function targetCorners(
  cuboid: ReturnType<typeof createCuboid>,
  neighbors: readonly [string, string, string, string],
  faceId: string,
) {
  const [top, right, bottom, left] = neighbors
  return [
    sharedCorner(cuboid, [faceId, top, left]),
    sharedCorner(cuboid, [faceId, top, right]),
    sharedCorner(cuboid, [faceId, right, bottom]),
    sharedCorner(cuboid, [faceId, bottom, left]),
  ]
}

function sharedCorner(cuboid: ReturnType<typeof createCuboid>, ids: string[]) {
  const faces = ids.map((id) => cuboid.faces.find((face) => face.id === id)!)
  return faces[0].vertices.find((candidate) =>
    faces
      .slice(1)
      .every((face) =>
        face.vertices.some(
          (point) =>
            Math.hypot(
              point.x - candidate.x,
              point.y - candidate.y,
              point.z - candidate.z,
            ) < 1e-8,
        ),
      ),
  )!
}
