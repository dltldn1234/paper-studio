import { describe, expect, it } from 'vitest'
import {
  createMaterialMap,
  setFaceMaterial,
  validateFaceMaterial,
} from './materials'

describe('face materials', () => {
  it('creates independent face materials and updates one face immutably', () => {
    const materials = createMaterialMap(['front', 'back'])
    const updated = setFaceMaterial(materials, 'front', { color: '#aabbcc' })

    expect(updated.front.color).toBe('#aabbcc')
    expect(updated.back.color).toBe('#566174')
    expect(materials.front.color).toBe('#566174')
  })

  it('validates local image data and bounded texture transforms', () => {
    expect(() =>
      validateFaceMaterial({
        color: '#112233',
        texture: {
          dataUrl: 'https://example.com/texture.png',
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          rotationDeg: 0,
        },
      }),
    ).toThrow('Face texture settings are invalid')
    expect(() => validateFaceMaterial({ color: 'red' })).toThrow(
      'six digit hex',
    )
  })
})
