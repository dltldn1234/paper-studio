import { describe, expect, it } from 'vitest'
import {
  createCuboid,
  createCuboidNet,
  MAX_DIMENSION_MM,
  MIN_DIMENSION_MM,
  validateCuboidDimensions,
} from './index'

const standardDimensions = { widthMm: 100, depthMm: 80, heightMm: 60 }

describe('cuboid geometry', () => {
  it('creates six faces and twelve shared edges for a cuboid', () => {
    const cuboid = createCuboid(standardDimensions)

    expect(cuboid.faces).toHaveLength(6)
    expect(cuboid.edges).toHaveLength(12)
    expect(new Set(cuboid.faces.map((face) => face.id)).size).toBe(6)
    expect(
      cuboid.edges.every((edge) => edge.adjacentFaceIds.length === 2),
    ).toBe(true)
  })

  it('assigns the expected dimensions to each pair of faces', () => {
    const { faces } = createCuboid(standardDimensions)
    const dimensionsByFace = Object.fromEntries(
      faces.map(({ id, widthMm, heightMm }) => [id, [widthMm, heightMm]]),
    )

    expect(dimensionsByFace).toEqual({
      front: [100, 60],
      right: [80, 60],
      back: [100, 60],
      left: [80, 60],
      top: [100, 80],
      bottom: [100, 80],
    })
  })

  it('creates a connected six-face net with five fold edges and fourteen cut edges', () => {
    const net = createCuboidNet(standardDimensions)

    expect(net.faces).toHaveLength(6)
    expect(net.edges.filter((edge) => edge.kind === 'fold')).toHaveLength(5)
    expect(net.edges.filter((edge) => edge.kind === 'cut')).toHaveLength(14)
    expect(net.bounds).toEqual({ x: 0, y: 0, width: 360, height: 220 })

    const foldConnections = net.edges
      .filter((edge) => edge.kind === 'fold')
      .map((edge) => [...edge.adjacentFaceIds].sort().join('-'))
      .sort()
    expect(foldConnections).toEqual(
      [
        'bottom-front',
        'front-left',
        'front-right',
        'front-top',
        'back-right',
      ].sort(),
    )
  })

  it('accepts the documented minimum and maximum dimensions', () => {
    expect(
      validateCuboidDimensions({
        widthMm: MIN_DIMENSION_MM,
        depthMm: MAX_DIMENSION_MM,
        heightMm: 1,
      }),
    ).toEqual({ valid: true, issues: [] })
  })

  it.each([
    [{ widthMm: 0, depthMm: 10, heightMm: 10 }, 'widthMm'],
    [{ widthMm: -1, depthMm: 10, heightMm: 10 }, 'widthMm'],
    [{ widthMm: Number.NaN, depthMm: 10, heightMm: 10 }, 'widthMm'],
    [
      { widthMm: 10, depthMm: Number.POSITIVE_INFINITY, heightMm: 10 },
      'depthMm',
    ],
    [{ widthMm: 10, depthMm: 10, heightMm: MAX_DIMENSION_MM + 1 }, 'heightMm'],
  ])('rejects invalid dimensions %o', (dimensions, field) => {
    const result = validateCuboidDimensions(dimensions)

    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0].field).toBe(field)
    expect(() => createCuboid(dimensions)).toThrow(RangeError)
    expect(() => createCuboidNet(dimensions)).toThrow(RangeError)
  })
})
