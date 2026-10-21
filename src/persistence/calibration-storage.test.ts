import { describe, expect, it } from 'vitest'
import {
  CALIBRATION_STORAGE_KEY,
  readCalibrationMeasurements,
  saveCalibrationMeasurement,
} from './calibration-storage'

function fakeStorage(initial?: string) {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(CALIBRATION_STORAGE_KEY, initial)
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('local print calibration storage', () => {
  it('saves, restores, and replaces a measured page reference', () => {
    const storage = fakeStorage()
    expect(
      saveCalibrationMeasurement(
        {
          paperSize: 'A4',
          targetMm: 100,
          measuredMm: 99.5,
          savedAt: '2026-10-21T00:00:00.000Z',
        },
        storage,
      ),
    ).toBe(true)
    saveCalibrationMeasurement(
      {
        paperSize: 'A4',
        targetMm: 100,
        measuredMm: 100,
        savedAt: '2026-10-21T00:01:00.000Z',
      },
      storage,
    )
    expect(readCalibrationMeasurements(storage)).toEqual([
      {
        paperSize: 'A4',
        targetMm: 100,
        measuredMm: 100,
        savedAt: '2026-10-21T00:01:00.000Z',
      },
    ])
  })

  it('ignores malformed persisted values and invalid measurements', () => {
    const storage = fakeStorage('{broken')
    expect(readCalibrationMeasurements(storage)).toEqual([])
    expect(
      saveCalibrationMeasurement(
        {
          paperSize: 'A4',
          targetMm: 100,
          measuredMm: -1,
          savedAt: 'now',
        },
        storage,
      ),
    ).toBe(false)
  })
})
