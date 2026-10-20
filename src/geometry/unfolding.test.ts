import { describe, expect, it } from 'vitest'
import { analyzePolyhedron } from './polyhedron'
import {
  createRegularCube,
  createRegularOctahedron,
  createRegularTetrahedron,
} from './regular-polyhedra'
import { findUnfoldedFaceOverlaps, unfoldPolyhedron } from './unfolding'
import type { PolyhedronMesh } from './types'

const solids = [
  { name: 'tetrahedron', create: createRegularTetrahedron },
  { name: 'cube', create: createRegularCube },
  { name: 'octahedron', create: createRegularOctahedron },
] as const

function area(polygon: Array<{ x: number; y: number }>): number {
  return Math.abs(
    polygon.reduce((sum, point, index) => {
      const next = polygon[(index + 1) % polygon.length]
      return sum + point.x * next.y - point.y * next.x
    }, 0) / 2,
  )
}

describe.each(solids)('$name unfolding', ({ create }) => {
  it('creates a non-overlapping net preserving edge lengths, face areas, and tree hinges', () => {
    const mesh = create(50)
    const result = unfoldPolyhedron(mesh)
    expect(result.success).toBe(true)
    if (!result.success) return

    const analysis = analyzePolyhedron(mesh)
    const positions = new Map(
      mesh.vertices.map((vertex) => [vertex.id, vertex.position]),
    )
    expect(result.layout.faces).toHaveLength(mesh.faces.length)
    expect(result.layout.foldEdgeIds).toHaveLength(mesh.faces.length - 1)
    expect(
      result.layout.edges.filter((edge) => edge.kind === 'cut'),
    ).toHaveLength(analysis.edges.length - mesh.faces.length + 1)
    for (const face of mesh.faces) {
      const unfoldedFace = result.layout.faces.find(
        (candidate) => candidate.id === face.id,
      )!
      const original = face.vertexIds.map((id) => positions.get(id)!)
      const originalArea = Math.hypot(
        ...(() => {
          const sum = { x: 0, y: 0, z: 0 }
          for (let index = 0; index < original.length; index += 1) {
            const a = original[index]
            const b = original[(index + 1) % original.length]
            sum.x += (a.y - b.y) * (a.z + b.z)
            sum.y += (a.z - b.z) * (a.x + b.x)
            sum.z += (a.x - b.x) * (a.y + b.y)
          }
          return [sum.x / 2, sum.y / 2, sum.z / 2]
        })(),
      )
      expect(area(unfoldedFace.polygon)).toBeCloseTo(originalArea, 6)
    }
    for (const edge of result.layout.edges) {
      const length2d = Math.hypot(
        edge.start.x - edge.end.x,
        edge.start.y - edge.end.y,
      )
      const a = positions.get(edge.vertexIds[0])!
      const b = positions.get(edge.vertexIds[1])!
      const length3d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
      expect(length2d).toBeCloseTo(length3d, 6)
    }
  })
})

it('returns mesh validation details for an invalid graph', () => {
  const invalid: PolyhedronMesh = {
    vertices: [{ id: 'a', position: { x: 0, y: 0, z: 0 } }],
    faces: [{ id: 'broken', vertexIds: ['a', 'missing', 'other'] }],
  }
  const result = unfoldPolyhedron(invalid)
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.reason).toBe('invalid-mesh')
    expect(result.issues).toContain('invalid-face')
  }
})

it('reports overlapping face pairs while allowing faces that only share an edge', () => {
  const rect = (x: number, y: number, width: number, height: number) => ({
    vertices: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
  })
  expect(
    findUnfoldedFaceOverlaps([
      { id: 'first', polygon: rect(0, 0, 3, 2).vertices },
      { id: 'second', polygon: rect(2, 1, 2, 2).vertices },
    ]),
  ).toEqual([{ firstFaceId: 'first', secondFaceId: 'second' }])
  expect(
    findUnfoldedFaceOverlaps([
      { id: 'first', polygon: rect(0, 0, 3, 2).vertices },
      { id: 'adjacent', polygon: rect(3, 0, 2, 2).vertices },
    ]),
  ).toEqual([])
})

it('rejects an invalid candidate search budget', () => {
  const result = unfoldPolyhedron(createRegularCube(10), { maxCandidates: 0 })
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.reason).toBe('invalid-mesh')
    expect(result.issues).toContain('invalid-search-options')
  }
})
