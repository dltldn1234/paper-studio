import { describe, expect, it } from 'vitest'
import { createAssemblyGuide } from './guide'
import type { FoldGraph } from '../folding'

const graph: FoldGraph = {
  rootFaceId: 'base',
  faces: [
    { id: 'base', center: { x: 0, y: 0, z: 0 } },
    { id: 'left', center: { x: -1, y: 0, z: 0 } },
    { id: 'top', center: { x: 0, y: 1, z: 0 } },
  ],
  hinges: [
    {
      id: 'fold-left',
      parentFaceId: 'base',
      childFaceId: 'left',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 0, y: 1, z: 0 },
      angleRadians: Math.PI / 2,
    },
    {
      id: 'fold-top',
      parentFaceId: 'base',
      childFaceId: 'top',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1, y: 0, z: 0 },
      angleRadians: -Math.PI / 2,
    },
  ],
}

describe('assembly guide engine', () => {
  it('creates a stable edge-ordered step for each child face', () => {
    const guide = createAssemblyGuide(graph)
    expect(guide.steps).toEqual([
      {
        index: 0,
        edgeId: 'fold-left',
        parentFaceId: 'base',
        faceId: 'left',
        angleDegrees: 90,
      },
      {
        index: 1,
        edgeId: 'fold-top',
        parentFaceId: 'base',
        faceId: 'top',
        angleDegrees: -90,
      },
    ])
    expect(guide.physicallyValidated).toBe(false)
    expect(guide.warnings).toHaveLength(1)
  })

  it('rejects disconnected fold graphs', () => {
    expect(() =>
      createAssemblyGuide({ ...graph, hinges: [graph.hinges[0]] }),
    ).toThrow('valid fold graph')
  })
})
