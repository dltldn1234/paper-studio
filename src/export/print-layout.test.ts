import { describe, expect, it } from 'vitest'
import { computePrintLayout } from './print-layout'

const a4Portrait = {
  paperSize: 'A4' as const,
  orientation: 'portrait' as const,
  marginMm: 10,
  overlapMm: 8,
}

describe('tiled print layout', () => {
  it('tiles a wide cuboid net over A4 portrait pages with overlap guides', () => {
    const layout = computePrintLayout(
      { x: 0, y: 0, width: 370, height: 220 },
      a4Portrait,
    )

    expect(layout.pageWidthMm).toBe(210)
    expect(layout.pageHeightMm).toBe(297)
    expect(layout.printableWidthMm).toBe(190)
    expect(layout.printableHeightMm).toBe(277)
    expect(layout.columns).toBe(2)
    expect(layout.rows).toBe(1)
    expect(layout.requiresMultiplePages).toBe(true)
    expect(layout.tiles.map(({ origin }) => origin.x)).toEqual([0, 182])
    expect(layout.tiles[0].guides[0].id).toBe(layout.tiles[1].guides[0].id)
    expect(layout.tiles[0].guides[0].point).toEqual(
      layout.tiles[1].guides[0].point,
    )
  })

  it('fits the same pattern on one A3 landscape page', () => {
    const layout = computePrintLayout(
      { x: 0, y: 0, width: 370, height: 220 },
      { ...a4Portrait, paperSize: 'A3', orientation: 'landscape' },
    )

    expect(layout.pageWidthMm).toBe(420)
    expect(layout.pageHeightMm).toBe(297)
    expect(layout.tiles).toHaveLength(1)
    expect(layout.requiresMultiplePages).toBe(false)
  })

  it('creates a row and column grid when both axes exceed the printable area', () => {
    const layout = computePrintLayout(
      { x: 4, y: 8, width: 500, height: 600 },
      a4Portrait,
    )
    expect(layout.columns).toBe(3)
    expect(layout.rows).toBe(3)
    expect(layout.tiles).toHaveLength(9)
    expect(
      layout.tiles.map(({ row, column, pageNumber }) => [
        row,
        column,
        pageNumber,
      ]),
    ).toEqual([
      [1, 1, 1],
      [1, 2, 2],
      [1, 3, 3],
      [2, 1, 4],
      [2, 2, 5],
      [2, 3, 6],
      [3, 1, 7],
      [3, 2, 8],
      [3, 3, 9],
    ])
  })

  it.each([
    [
      { x: 0, y: 0, width: 100, height: 100 },
      { ...a4Portrait, marginMm: 110 },
    ],
    [
      { x: 0, y: 0, width: 100, height: 100 },
      { ...a4Portrait, overlapMm: 190 },
    ],
    [{ x: 0, y: 0, width: 0, height: 100 }, a4Portrait],
  ])('rejects invalid print input %o', (bounds, settings) => {
    expect(() => computePrintLayout(bounds, settings)).toThrow(RangeError)
  })

  it('rejects print jobs that would create an excessive number of pages', () => {
    expect(() =>
      computePrintLayout(
        { x: 0, y: 0, width: 100_000, height: 100_000 },
        a4Portrait,
      ),
    ).toThrow('500-page limit')
  })
})
