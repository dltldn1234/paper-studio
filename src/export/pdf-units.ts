import type { Point2D } from '../geometry'

export const PDF_POINTS_PER_MM = 72 / 25.4

export type PdfPagePoint = { x: number; y: number }

export function mmToPdfPoints(valueMm: number) {
  if (!Number.isFinite(valueMm)) {
    throw new RangeError('Millimetre values must be finite.')
  }
  return valueMm * PDF_POINTS_PER_MM
}

export function pdfPointsToMm(valuePoints: number) {
  if (!Number.isFinite(valuePoints)) {
    throw new RangeError('PDF point values must be finite.')
  }
  return valuePoints / PDF_POINTS_PER_MM
}

export function worldPointToPdfPage(
  point: Point2D,
  tileOrigin: Point2D,
  marginMm: number,
  pageHeightMm: number,
): PdfPagePoint {
  return {
    x: mmToPdfPoints(marginMm + point.x - tileOrigin.x),
    y: mmToPdfPoints(pageHeightMm - marginMm - point.y + tileOrigin.y),
  }
}

export function worldPointToPreview(
  point: Point2D,
  tileOrigin: Point2D,
  marginMm: number,
): Point2D {
  return {
    x: marginMm + point.x - tileOrigin.x,
    y: marginMm + point.y - tileOrigin.y,
  }
}

export function pdfPagePointToPreview(
  point: PdfPagePoint,
  pageHeightMm: number,
): Point2D {
  return {
    x: pdfPointsToMm(point.x),
    y: pageHeightMm - pdfPointsToMm(point.y),
  }
}
