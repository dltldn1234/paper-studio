import { describe, expect, it } from 'vitest'
import { createRegularTetrahedron, unfoldPolyhedron } from '../geometry'
import { createPrintableNet } from './printable-net'
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

  it('includes generic glue tabs in printable bounds and SVG cut paths', () => {
    const unfolded = unfoldPolyhedron(createRegularTetrahedron(60))
    expect(unfolded.success).toBe(true)
    if (!unfolded.success) return
    const printable = createPrintableNet(unfolded.layout, {
      enabled: true,
      widthMm: 8,
      angleDeg: 45,
    })
    expect(printable.glueTabs).toHaveLength(3)
    expect(
      printable.glueTabs.every((tab) =>
        tab.polygon.vertices.every(
          (point) =>
            point.x >= printable.bounds.x &&
            point.y >= printable.bounds.y &&
            point.x <= printable.bounds.x + printable.bounds.width &&
            point.y <= printable.bounds.y + printable.bounds.height,
        ),
      ),
    ).toBe(true)

    const svg = serializeUnfoldedNetToSvg(
      unfolded.layout,
      'Tetrahedron with tabs',
      printable.glueTabs,
    )
    expect(svg.match(/class="cut glue-tab"/g)).toHaveLength(3)
    expect(svg).toContain('glue-tab')
    expect(svg).toContain('at actual size')
  })
})
