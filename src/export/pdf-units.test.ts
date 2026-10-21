import { describe, expect, it } from 'vitest'
import {
  mmToPdfPoints,
  PDF_POINTS_PER_MM,
  pdfPagePointToPreview,
  pdfPointsToMm,
  worldPointToPdfPage,
  worldPointToPreview,
} from './pdf-units'

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

  it.each([
    { point: { x: 12.5, y: 40 }, origin: { x: 8, y: 9 }, margin: 10 },
    { point: { x: 190, y: 275 }, origin: { x: 0, y: 0 }, margin: 10 },
  ])(
    'keeps preview and PDF world coordinates aligned',
    ({ point, origin, margin }) => {
      const pageHeightMm = 297
      const pdfPoint = worldPointToPdfPage(point, origin, margin, pageHeightMm)
      const pdfPreviewPoint = pdfPagePointToPreview(pdfPoint, pageHeightMm)
      const svgPreviewPoint = worldPointToPreview(point, origin, margin)
      expect(pdfPreviewPoint.x).toBeCloseTo(svgPreviewPoint.x, 10)
      expect(pdfPreviewPoint.y).toBeCloseTo(svgPreviewPoint.y, 10)
    },
  )
})
