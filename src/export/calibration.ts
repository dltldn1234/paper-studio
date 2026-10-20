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
