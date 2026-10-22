import { describe, expect, it } from 'vitest'
import { createMeasurementHistoryEntry } from './measurement-history'
import { createPrinterProfile } from './printer-profiles'
import {
  analyzeAccuracy,
  buildAccuracySamples,
  compareCalibrationPhases,
  filterAccuracySamples,
} from './statistics'

const profile = createPrinterProfile({
  id: 'printer-a',
  name: 'Studio printer',
  manufacturer: 'Maker',
  model: 'M1',
  driverInfo: 'Driver A',
  paperSize: 'A4',
  orientation: 'portrait',
})

function sample(
  id: string,
  measuredMm: number,
  measuredAt: string,
  phase: 'calibration' | 'verification' = 'calibration',
  axis: 'x' | 'y' = 'x',
) {
  return createMeasurementHistoryEntry({
    id,
    profileId: profile.id,
    paperSize: 'A4',
    phase,
    axis,
    targetMm: 100,
    measuredMm,
    measuredAt,
  })
}

describe('measurement accuracy statistics', () => {
  it('calculates signed and absolute error, rates, sample deviation and range', () => {
    const samples = buildAccuracySamples(
      [
        sample('one', 99, '2026-01-01T00:00:00Z'),
        sample('two', 100, '2026-01-02T00:00:00Z'),
        sample('three', 102, '2026-01-03T00:00:00Z'),
      ],
      [profile],
    )
    expect(analyzeAccuracy(samples)).toMatchObject({
      sampleCount: 3,
      meanErrorMm: 1 / 3,
      meanAbsoluteErrorMm: 1,
      meanErrorRatePercent: 1 / 3,
      minimumErrorMm: -1,
      maximumErrorMm: 2,
      trend: 'worsening',
    })
    expect(analyzeAccuracy(samples)?.standardDeviationMm).toBeCloseTo(1.5275, 3)
  })

  it('returns null for empty records and uses zero deviation for one sample', () => {
    expect(analyzeAccuracy([])).toBeNull()
    const one = buildAccuracySamples(
      [sample('one', 100.25, '2026-01-01T00:00:00Z')],
      [profile],
    )
    expect(analyzeAccuracy(one)).toMatchObject({
      standardDeviationMm: 0,
      trend: 'insufficient',
    })
  })

  it('flags extreme outliers without modifying input or dropping samples', () => {
    const entries = [
      sample('a', 100, '2026-01-01T00:00:00Z'),
      sample('b', 100.1, '2026-01-02T00:00:00Z'),
      sample('c', 99.9, '2026-01-03T00:00:00Z'),
      sample('outlier', 110, '2026-01-04T00:00:00Z'),
    ]
    const samples = buildAccuracySamples(entries, [profile])
    const result = analyzeAccuracy(samples)
    expect(result?.outlierIds).toEqual(['outlier'])
    expect(result?.sampleCount).toBe(4)
    expect(samples).toHaveLength(4)
  })

  it('compares axes, drivers, phases, paper and profile filters', () => {
    const samples = buildAccuracySamples(
      [
        sample('x', 99, '2026-01-01T00:00:00Z'),
        sample('y', 102, '2026-01-02T00:00:00Z', 'calibration', 'y'),
        sample('after', 99.8, '2026-01-03T00:00:00Z', 'verification'),
      ],
      [profile],
    )
    expect(
      filterAccuracySamples(samples, { axis: 'y' }).map(({ id }) => id),
    ).toEqual(['y'])
    expect(filterAccuracySamples(samples, { profileId: 'other' })).toHaveLength(
      0,
    )
    expect(
      filterAccuracySamples(samples, { driverInfo: 'Driver A' }),
    ).toHaveLength(3)
    expect(filterAccuracySamples(samples, { paperSize: 'A3' })).toHaveLength(0)
    expect(compareCalibrationPhases(samples)?.improvementMm).toBeCloseTo(1.3)
  })

  it('reports time trend in chronological order, independent of input order', () => {
    const entries = [
      sample('last', 100.1, '2026-01-03T00:00:00Z'),
      sample('first', 103, '2026-01-01T00:00:00Z'),
      sample('middle', 101, '2026-01-02T00:00:00Z'),
    ]
    expect(
      analyzeAccuracy(buildAccuracySamples(entries, [profile]))?.trend,
    ).toBe('improving')
  })

  it('filters malformed or non-mm-valid records through the existing history validator', () => {
    const invalid = {
      ...sample('bad', 100, '2026-01-01T00:00:00Z'),
      measuredMm: 0,
    }
    expect(buildAccuracySamples([invalid as never], [profile])).toEqual([])
  })
})
