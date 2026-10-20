import { describe, expect, it } from 'vitest'
import { analyzePolyhedron, calculateFaceNormal } from './polyhedron'
import type { PolyhedronMesh } from './types'

const tetrahedronFixture: PolyhedronMesh = {
  vertices: [
    { id: 'a', position: { x: 1, y: 1, z: 1 } },
    { id: 'b', position: { x: -1, y: -1, z: 1 } },
    { id: 'c', position: { x: -1, y: 1, z: -1 } },
    { id: 'd', position: { x: 1, y: -1, z: -1 } },
  ],
  faces: [
    { id: 'abc', vertexIds: ['b', 'c', 'd'] },
    { id: 'bcd', vertexIds: ['a', 'd', 'c'] },
    { id: 'cda', vertexIds: ['a', 'b', 'd'] },
    { id: 'dab', vertexIds: ['a', 'c', 'b'] },
  ],
}

describe('generic polyhedron topology', () => {
  it('derives the six edges, outward normals, and Euler characteristic of a tetrahedron', () => {
    const analysis = analyzePolyhedron(tetrahedronFixture)

    expect(analysis.valid).toBe(true)
    expect(analysis.edges).toHaveLength(6)
    expect(
      analysis.edges.every((edge) => edge.adjacentFaceIds.length === 2),
    ).toBe(true)
    expect(analysis.faceNormals.size).toBe(4)
    expect(analysis.eulerCharacteristic).toBe(2)
    expect(analysis.orientation).toBe('outward')
    expect(analysis.signedVolume).toBeCloseTo(8 / 3)
  })

  it('calculates a normalized normal from a polygon winding', () => {
    expect(
      calculateFaceNormal([
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 2, y: 3, z: 0 },
        { x: 0, y: 3, z: 0 },
      ]),
    ).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('reports reversed face winding and inward global orientation', () => {
    const reversed = {
      ...tetrahedronFixture,
      faces: tetrahedronFixture.faces.map((face) => ({
        ...face,
        vertexIds: [...face.vertexIds].reverse(),
      })),
    }
    const analysis = analyzePolyhedron(reversed)
    expect(analysis.orientation).toBe('inward')
    expect(
      analysis.issues.some((issue) => issue.kind === 'inward-winding'),
    ).toBe(true)
    expect(
      analysis.issues.some((issue) => issue.kind === 'inconsistent-winding'),
    ).toBe(false)
  })

  it('reports inconsistent local winding and open or non-manifold edges', () => {
    const opened = {
      ...tetrahedronFixture,
      faces: tetrahedronFixture.faces.slice(0, 3),
    }
    const openAnalysis = analyzePolyhedron(opened)
    expect(
      openAnalysis.issues.some((issue) => issue.kind === 'non-manifold-edge'),
    ).toBe(true)

    const reversedOne = {
      ...tetrahedronFixture,
      faces: tetrahedronFixture.faces.map((face, index) =>
        index === 0
          ? { ...face, vertexIds: [...face.vertexIds].reverse() }
          : face,
      ),
    }
    expect(
      analyzePolyhedron(reversedOne).issues.some(
        (issue) => issue.kind === 'inconsistent-winding',
      ),
    ).toBe(true)
  })

  it('reports missing vertices, degeneracy, disconnected components, and Euler failures', () => {
    const invalid: PolyhedronMesh = {
      vertices: [
        { id: 'a', position: { x: 0, y: 0, z: 0 } },
        { id: 'b', position: { x: 1, y: 0, z: 0 } },
        { id: 'c', position: { x: 2, y: 0, z: 0 } },
        { id: 'd', position: { x: 0, y: 1, z: 0 } },
        { id: 'unused', position: { x: 8, y: 8, z: 8 } },
      ],
      faces: [
        { id: 'flat', vertexIds: ['a', 'b', 'c'] },
        { id: 'missing', vertexIds: ['a', 'c', 'absent'] },
        { id: 'separate', vertexIds: ['a', 'b', 'd'] },
      ],
    }
    const analysis = analyzePolyhedron(invalid)
    expect(
      analysis.issues.some((issue) => issue.kind === 'degenerate-face'),
    ).toBe(true)
    expect(analysis.issues.some((issue) => issue.kind === 'invalid-face')).toBe(
      true,
    )
    expect(analysis.issues.some((issue) => issue.kind === 'disconnected')).toBe(
      true,
    )
    expect(
      analysis.issues.some((issue) => issue.kind === 'euler-characteristic'),
    ).toBe(true)
  })
})
