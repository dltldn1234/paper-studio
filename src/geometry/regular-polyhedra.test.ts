import { describe, expect, it } from 'vitest'
import { analyzePolyhedron } from './polyhedron'
import {
  createRegularCube,
  createRegularOctahedron,
  createRegularPolyhedron,
  createRegularTetrahedron,
} from './regular-polyhedra'

const solids = [
  { name: 'tetrahedron', create: createRegularTetrahedron, v: 4, e: 6, f: 4 },
  { name: 'cube', create: createRegularCube, v: 8, e: 12, f: 6 },
  { name: 'octahedron', create: createRegularOctahedron, v: 6, e: 12, f: 8 },
] as const

describe.each(solids)('regular $name generator', ({ create, v, e, f }) => {
  it('generates a closed, connected, outward-oriented regular mesh', () => {
    const mesh = create(123.456)
    const analysis = analyzePolyhedron(mesh)
    const vertexMap = new Map(
      mesh.vertices.map((item) => [item.id, item.position]),
    )
    const edgeLengths = analysis.edges.map((edge) => {
      const start = vertexMap.get(edge.vertexIds[0])!
      const end = vertexMap.get(edge.vertexIds[1])!
      return Math.hypot(start.x - end.x, start.y - end.y, start.z - end.z)
    })

    expect(mesh.vertices).toHaveLength(v)
    expect(mesh.faces).toHaveLength(f)
    expect(analysis.edges).toHaveLength(e)
    expect(analysis.valid).toBe(true)
    expect(analysis.eulerCharacteristic).toBe(2)
    expect(analysis.orientation).toBe('outward')
    expect(
      analysis.edges.every((edge) => edge.adjacentFaceIds.length === 2),
    ).toBe(true)
    expect(
      edgeLengths.every((length) => Math.abs(length - 123.456) < 1e-7),
    ).toBe(true)
  })

  it('rejects invalid edge lengths', () => {
    expect(() => create(0)).toThrow(RangeError)
    expect(() => create(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})

it('dispatches through the regular solid kind', () => {
  expect(createRegularPolyhedron('tetrahedron', 10).faces).toHaveLength(4)
  expect(createRegularPolyhedron('cube', 10).faces).toHaveLength(6)
  expect(createRegularPolyhedron('octahedron', 10).faces).toHaveLength(8)
})
