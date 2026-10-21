export const PDF_POINTS_PER_MM = 72 / 25.4

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
