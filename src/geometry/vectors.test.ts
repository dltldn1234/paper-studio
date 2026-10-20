import { describe, expect, it } from 'vitest'
import {
  cross3D,
  dot2D,
  length3D,
  normalize2D,
  normalize3D,
  subtract2D,
} from './vectors'

describe('vector utilities', () => {
  it('subtracts points and calculates a 2D dot product', () => {
    const vector = subtract2D({ x: 7, y: 5 }, { x: 2, y: 1 })

    expect(vector).toEqual({ x: 5, y: 4 })
    expect(dot2D(vector, { x: 2, y: 3 })).toBe(22)
  })

  it('normalizes vectors and computes a 3D cross product', () => {
    expect(normalize2D({ x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 })
    expect(cross3D({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({
      x: 0,
      y: 0,
      z: 1,
    })
    expect(length3D(normalize3D({ x: 4, y: 0, z: 0 }))).toBe(1)
  })

  it('rejects normalization of a zero vector', () => {
    expect(() => normalize2D({ x: 0, y: 0 })).toThrow(RangeError)
    expect(() => normalize3D({ x: 0, y: 0, z: 0 })).toThrow(RangeError)
  })
})
