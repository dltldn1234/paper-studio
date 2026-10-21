import type { NetBounds } from '../geometry'

export const CALIBRATION_SIZE_MM = 100
export const CALIBRATION_GAP_MM = 10
export const CALIBRATION_REFERENCE_LENGTHS = [50, 100, 150] as const

export type CalibrationReferenceLength =
  (typeof CALIBRATION_REFERENCE_LENGTHS)[number]
export type CalibrationResult = {
  targetMm: CalibrationReferenceLength
  measuredMm: number
  outputScalePercent: number
  scaleErrorPercent: number
  status: 'within-tolerance' | 'adjust-print-scale'
}

export type CalibrationGuide = {
  x: number
  y: number
  sizeMm: number
  lineY: number
  bounds: NetBounds
}

export type PdfCalibrationGuide = {
  square: { x: number; y: number; sizeMm: number }
  lines: Array<{
    x1: number
    x2: number
    y: number
    labelY: number
    lengthMm: CalibrationReferenceLength
  }>
  verticalLines: Array<{
    x: number
    y1: number
    y2: number
    labelX: number
    labelY: number
    lengthMm: CalibrationReferenceLength
  }>
}

export function calculateCalibrationResult(
  targetMm: CalibrationReferenceLength,
  measuredMm: number,
): CalibrationResult {
  if (
    !CALIBRATION_REFERENCE_LENGTHS.includes(targetMm) ||
    !Number.isFinite(measuredMm) ||
    measuredMm <= 0
  ) {
    throw new RangeError(
      'Calibration measurements must be finite and positive.',
    )
  }
  const outputScalePercent = (measuredMm / targetMm) * 100
  const scaleErrorPercent = outputScalePercent - 100
  return {
    targetMm,
    measuredMm,
    outputScalePercent,
    scaleErrorPercent,
    status:
      Math.abs(scaleErrorPercent) <= 1
        ? 'within-tolerance'
        : 'adjust-print-scale',
  }
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
  const lowestLineY = y - 30
  if (
    x + 150 > pageWidthMm - marginMm ||
    lowestLineY - 7 < marginMm ||
    y + sizeMm > pageHeightMm - marginMm ||
    marginMm + 20 + 150 > pageHeightMm - marginMm
  ) {
    throw new RangeError(
      'Calibration marks do not fit inside the printable page area.',
    )
  }
  return {
    square: { x, y, sizeMm },
    lines: CALIBRATION_REFERENCE_LENGTHS.map((lengthMm, index) => {
      const lineY = y - 10 - index * 10
      return {
        x1: x,
        x2: x + lengthMm,
        y: lineY,
        labelY: lineY - 4,
        lengthMm,
      }
    }),
    verticalLines: CALIBRATION_REFERENCE_LENGTHS.map((lengthMm) => {
      const x = pageWidthMm - marginMm - 20
      const y1 = marginMm + 20
      return {
        x,
        y1,
        y2: y1 + lengthMm,
        labelX: x - 28,
        labelY: y1 - 4,
        lengthMm,
      }
    }),
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
