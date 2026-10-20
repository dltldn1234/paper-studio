import type { NetBounds } from '../geometry'

export const CALIBRATION_SIZE_MM = 100
export const CALIBRATION_GAP_MM = 10

export type CalibrationGuide = {
  x: number
  y: number
  sizeMm: number
  lineY: number
  bounds: NetBounds
}

export type PdfCalibrationGuide = {
  square: { x: number; y: number; sizeMm: number }
  line: { x1: number; x2: number; y: number }
  label: { x: number; y: number }
}

export function createPdfCalibrationGuide(
  pageWidthMm: number,
  pageHeightMm: number,
  marginMm: number,
): PdfCalibrationGuide {
  if (
    ![pageWidthMm, pageHeightMm, marginMm].every(Number.isFinite) ||
    marginMm < 0
  ) {
    throw new RangeError(
      'Page dimensions and calibration margin must be finite.',
    )
  }
  const sizeMm = CALIBRATION_SIZE_MM
  const x = marginMm + 20
  const y = pageHeightMm - marginMm - sizeMm - 20
  if (x + sizeMm > pageWidthMm - marginMm || y - 22 < marginMm) {
    throw new RangeError(
      'Calibration marks do not fit inside the printable page area.',
    )
  }
  return {
    square: { x, y, sizeMm },
    line: { x1: x, x2: x + sizeMm, y: y - 10 },
    label: { x, y: y - 17 },
  }
}

/** Places a 100 mm square and line in an unoccupied area beside an SVG net. */
export function createSvgCalibrationGuide(
  netBounds: NetBounds,
): CalibrationGuide {
  const { x, y, width, height } = netBounds
  if (
    ![x, y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError(
      'Net bounds must be finite and positive for calibration output.',
    )
  }
  const sizeMm = CALIBRATION_SIZE_MM
  const guideHeight = sizeMm + 15
  const guideY = y + Math.max(0, (height - guideHeight) / 2)
  const guideX = x + width + CALIBRATION_GAP_MM
  return {
    x: guideX,
    y: guideY,
    sizeMm,
    lineY: guideY + sizeMm + 5,
    bounds: {
      x,
      y,
      width: width + CALIBRATION_GAP_MM + sizeMm,
      height: Math.max(height, guideY - y + guideHeight),
    },
  }
}
