import { describe, expect, it } from 'vitest'
import { mmToPdfPoints, PDF_POINTS_PER_MM, pdfPointsToMm } from './pdf-units'

describe('PDF physical unit conversion', () => {
  it.each([0, 0.1, 50, 100, 150, 210, 420])(
    'round-trips %s millimetres through PDF points',
    (millimetres) => {
      expect(mmToPdfPoints(millimetres)).toBeCloseTo(
        millimetres * PDF_POINTS_PER_MM,
        12,
      )
      expect(pdfPointsToMm(mmToPdfPoints(millimetres))).toBeCloseTo(
        millimetres,
        12,
      )
    },
  )

  it('rejects non-finite conversions', () => {
    expect(() => mmToPdfPoints(Number.NaN)).toThrow('finite')
    expect(() => pdfPointsToMm(Number.POSITIVE_INFINITY)).toThrow('finite')
  })
})
