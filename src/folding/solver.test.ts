import { describe, expect, it } from 'vitest'
import { createCuboid, createCuboidNet } from '../geometry'
import { createCuboidFoldGraph } from './cuboid-adapter'
import { rotatePoint, transformPoint } from './math'
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
      const graph = createCuboidFoldGraph(createCuboidNet(dimensions), cuboid)
      const poses = new Map(
        solveFoldPoses(graph, 1).map((pose) => [pose.faceId, pose.transform]),
      )
      expect(graph.hinges).toHaveLength(5)
      for (const face of cuboid.faces) {
        const transform = poses.get(face.id)!
        const localPoints = face.vertices.map((point) => ({
          x: point.x - face.center.x,
          y: point.z - face.center.z,
          z: 0,
        }))
        const corners = localPoints.map((point) =>
          transformPoint(transform, point),
        )
        expect(
          corners.every((point) =>
            Number.isFinite(point.x + point.y + point.z),
          ),
        ).toBe(true)
        const normal = rotatePoint(transform.rotation, { x: 0, y: 0, z: 1 })
        expect(Math.hypot(normal.x, normal.y, normal.z)).toBeCloseTo(1)
      }
    },
  )
})
