import { describe, expect, it } from 'vitest'
import {
  analyzeCalibrationAxis,
  canApplyPrinterCorrection,
  compareCalibrationMeasurement,
} from './precision'

describe('precision calibration engine', () => {
  it('calculates target-to-measured correction independently for each axis', () => {
    const x = analyzeCalibrationAxis([
      { targetMm: 50, measuredMm: 49.5 },
      { targetMm: 100, measuredMm: 99 },
      { targetMm: 150, measuredMm: 148.5 },
    ])
    const y = analyzeCalibrationAxis([
      { targetMm: 50, measuredMm: 50.5 },
      { targetMm: 100, measuredMm: 101 },
      { targetMm: 150, measuredMm: 151.5 },
    ])
    expect(x.status).toBe('ready')
    expect(x.correctionScale).toBeCloseTo(100 / 99)
    expect(y.status).toBe('ready')
    expect(y.correctionScale).toBeCloseTo(100 / 101)
  })

  it('requires at least two different lengths and rejects invalid data', () => {
    expect(
      analyzeCalibrationAxis([{ targetMm: 100, measuredMm: 99 }]),
    ).toMatchObject({
      status: 'insufficient',
      correctionScale: null,
    })
    expect(
      analyzeCalibrationAxis([
        { targetMm: 50, measuredMm: 49 },
        { targetMm: 50, measuredMm: 49 },
      ]).status,
    ).toBe('insufficient')
    expect(
      analyzeCalibrationAxis([
        { targetMm: 50, measuredMm: 49 },
        { targetMm: 100, measuredMm: 0 },
      ]).status,
    ).toBe('invalid')
  })

  it('flags outliers and inconsistent reference scales instead of recommending use', () => {
    const outlier = analyzeCalibrationAxis([
      { targetMm: 50, measuredMm: 49.5 },
      { targetMm: 100, measuredMm: 99 },
      { targetMm: 150, measuredMm: 100 },
    ])
    expect(outlier.status).toBe('ready')
    expect(outlier.outlierTargetsMm).toEqual([150])
    expect(outlier.acceptedCount).toBe(2)

    const inconsistent = analyzeCalibrationAxis([
      { targetMm: 50, measuredMm: 50 },
      { targetMm: 100, measuredMm: 95 },
    ])
    expect(inconsistent.status).toBe('inconsistent')
    expect(inconsistent.correctionScale).toBeCloseTo(1.0263158)
  })

  it('reports dimensional error and prevents applying a profile twice', () => {
    expect(compareCalibrationMeasurement(100, 99)).toMatchObject({
      errorMm: -1,
      errorPercent: -1,
      correctionScale: 100 / 99,
    })
    expect(canApplyPrinterCorrection('printer-a', [])).toBe(true)
    expect(canApplyPrinterCorrection('printer-a', ['printer-a'])).toBe(false)
    expect(canApplyPrinterCorrection('', [])).toBe(false)
  })
})
