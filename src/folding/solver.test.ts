import { describe, expect, it } from 'vitest'
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
})
