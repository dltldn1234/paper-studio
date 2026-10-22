export const CALIBRATION_SHEET_SQUARE_MM = 100
export const CALIBRATION_SHEET_DIAGONAL_MM = Math.hypot(
  CALIBRATION_SHEET_SQUARE_MM,
  CALIBRATION_SHEET_SQUARE_MM,
)

export type CalibrationSheetReadings = {
  horizontalMm: number
  verticalMm: number
  diagonalMm: number
  leftRightOffsetMm: number
  topBottomOffsetMm: number
}

export type CalibrationSheetAnalysis = {
  horizontalErrorMm: number
  verticalErrorMm: number
  diagonalErrorMm: number
  leftRightOffsetMm: number
  topBottomOffsetMm: number
  physicalMeasurementsEntered: true
  profileVerificationRequired: true
}

export function analyzeCalibrationSheetReadings(
  readings: CalibrationSheetReadings,
): CalibrationSheetAnalysis {
  const lengths = [
    readings.horizontalMm,
    readings.verticalMm,
    readings.diagonalMm,
  ]
  const offsets = [readings.leftRightOffsetMm, readings.topBottomOffsetMm]
  if (
    !lengths.every(
      (value) => Number.isFinite(value) && value > 0 && value <= 500,
    ) ||
    !offsets.every((value) => Number.isFinite(value) && Math.abs(value) <= 100)
  ) {
    throw new RangeError(
      '측정 길이는 0보다 크고 500 mm 이하여야 하며 정렬 오차는 ±100 mm 이내여야 합니다.',
    )
  }
  return {
    horizontalErrorMm: readings.horizontalMm - CALIBRATION_SHEET_SQUARE_MM,
    verticalErrorMm: readings.verticalMm - CALIBRATION_SHEET_SQUARE_MM,
    diagonalErrorMm: readings.diagonalMm - CALIBRATION_SHEET_DIAGONAL_MM,
    leftRightOffsetMm: readings.leftRightOffsetMm,
    topBottomOffsetMm: readings.topBottomOffsetMm,
    physicalMeasurementsEntered: true,
    profileVerificationRequired: true,
  }
}
