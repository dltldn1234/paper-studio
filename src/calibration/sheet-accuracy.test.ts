import { describe, expect, it } from 'vitest'
import {
  analyzeCalibrationSheetReadings,
  CALIBRATION_SHEET_DIAGONAL_MM,
} from './sheet-accuracy'

describe('advanced calibration sheet accuracy', () => {
  it('reports X/Y, diagonal, and page alignment deviations', () => {
    const result = analyzeCalibrationSheetReadings({
      horizontalMm: 99.5,
      verticalMm: 100.8,
      diagonalMm: CALIBRATION_SHEET_DIAGONAL_MM + 1.2,
      leftRightOffsetMm: -0.6,
      topBottomOffsetMm: 0.25,
    })
    expect(result.horizontalErrorMm).toBeCloseTo(-0.5)
    expect(result.verticalErrorMm).toBeCloseTo(0.8)
    expect(result.diagonalErrorMm).toBeCloseTo(1.2)
    expect(result).toMatchObject({
      leftRightOffsetMm: -0.6,
      topBottomOffsetMm: 0.25,
      physicalMeasurementsEntered: true,
      profileVerificationRequired: true,
    })
  })

  it.each([
    {
      horizontalMm: 0,
      verticalMm: 100,
      diagonalMm: 141,
      leftRightOffsetMm: 0,
      topBottomOffsetMm: 0,
    },
    {
      horizontalMm: 501,
      verticalMm: 100,
      diagonalMm: 141,
      leftRightOffsetMm: 0,
      topBottomOffsetMm: 0,
    },
    {
      horizontalMm: 100,
      verticalMm: Number.NaN,
      diagonalMm: 141,
      leftRightOffsetMm: 0,
      topBottomOffsetMm: 0,
    },
    {
      horizontalMm: 100,
      verticalMm: 100,
      diagonalMm: 141,
      leftRightOffsetMm: 101,
      topBottomOffsetMm: 0,
    },
  ])(
    'rejects invalid or non-finite readings $horizontalMm/$verticalMm',
    (readings) => {
      expect(() => analyzeCalibrationSheetReadings(readings)).toThrow(
        RangeError,
      )
    },
  )
})
