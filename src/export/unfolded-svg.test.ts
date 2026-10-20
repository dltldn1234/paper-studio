import { describe, expect, it } from 'vitest'
import { createRegularTetrahedron, unfoldPolyhedron } from '../geometry'
import { serializeUnfoldedNetToSvg } from './svg'

describe('generic unfolded SVG export', () => {
  it('preserves millimetre bounds and cut/fold line styling', () => {
    const unfolded = unfoldPolyhedron(createRegularTetrahedron(40))
    expect(unfolded.success).toBe(true)
    if (!unfolded.success) return
    const svg = serializeUnfoldedNetToSvg(unfolded.layout, 'Tetrahedron')
    const { width, height, x, y } = unfolded.layout.bounds
    const printable = (value: number) => Number(value.toFixed(5)).toString()

    expect(svg).toContain(
      `width="${printable(width)}mm" height="${printable(height)}mm"`,
    )
    expect(svg).toContain(
      `viewBox="${printable(x)} ${printable(y)} ${printable(width)} ${printable(height)}"`,
    )
    expect(svg).toContain('class="cut" data-kind="cut"')
    expect(svg).toContain('class="fold" data-kind="fold"')
    expect(svg).toContain('<title id="title">Tetrahedron</title>')
    expect(svg).toContain('Print at 100%')
  })

  it('rejects bounds that do not contain every edge', () => {
    const unfolded = unfoldPolyhedron(createRegularTetrahedron(40))
    expect(unfolded.success).toBe(true)
    if (!unfolded.success) return
    const shortened = {
      ...unfolded.layout,
      bounds: {
        ...unfolded.layout.bounds,
        width: unfolded.layout.bounds.width / 2,
      },
    }
    expect(() => serializeUnfoldedNetToSvg(shortened)).toThrow(RangeError)
  })
})
