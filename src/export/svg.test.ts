import { describe, expect, it } from 'vitest'
import { createCuboidNet } from '../geometry'
import {
  normalizeSvgFilename,
  serializeNetToSvg,
  validateNetBounds,
} from './svg'

const dimensions = { widthMm: 100, depthMm: 80, heightMm: 60 }

describe('SVG net export', () => {
  it('uses exact millimeter dimensions and a matching viewBox', () => {
    const net = createCuboidNet(dimensions)
    validateNetBounds(net)
    const svg = serializeNetToSvg(net)

    expect(svg).toContain('width="470mm" height="220mm"')
    expect(svg).toContain('viewBox="0 0 470 220"')
    expect(svg).toContain('1:1 millimeter cut and fold pattern')
    expect(svg).toContain('width="100" height="100"')
    expect(svg).toContain('x2="470"')
    expect(svg).toContain('100 mm · PRINT AT 100%')
  })

  it('rejects bounds that clip a face or tab', () => {
    const net = createCuboidNet(dimensions, {
      enabled: true,
      widthMm: 10,
      angleDeg: 45,
    })
    expect(() =>
      validateNetBounds({
        ...net,
        bounds: { ...net.bounds, width: net.bounds.width - 1 },
      }),
    ).toThrow('Net bounds do not contain every face, edge, and glue tab')
  })

  it('exports glue tabs with solid cut outlines and dashed attachment folds', () => {
    const svg = serializeNetToSvg(
      createCuboidNet(dimensions, {
        enabled: true,
        widthMm: 10,
        angleDeg: 45,
      }),
    )

    expect(svg.match(/class="cut glue-tab"/g)).toHaveLength(7)
    expect(svg.match(/class="fold"/g)).toHaveLength(12)
    expect(svg).toContain('width="480mm" height="220mm"')
    expect(svg).toContain('stroke-dasharray: 2 1')
  })

  it('escapes document titles and labels as XML', () => {
    const svg = serializeNetToSvg(createCuboidNet(dimensions), 'Box <A> & "B"')
    expect(svg).toContain('Box &lt;A&gt; &amp; &quot;B&quot;')
  })

  it.each([
    ['box', 'box.svg'],
    ['folder/box.svg', 'folder-box.svg'],
    ['../box.svg', '-box.svg'],
    ['', 'paper-studio-net.svg'],
  ])('normalizes filename %j', (input, expected) => {
    expect(normalizeSvgFilename(input)).toBe(expected)
  })
})
