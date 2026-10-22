import { describe, expect, it } from 'vitest'
import { createMeasurementHistoryEntry } from '../calibration/measurement-history'
import {
  deleteMeasurementHistoryEntry,
  exportMeasurementHistory,
  importMeasurementHistory,
  MEASUREMENT_HISTORY_STORAGE_KEY,
  readMeasurementHistory,
  saveMeasurementHistoryEntry,
} from './measurement-history'
import { CALIBRATION_STORAGE_KEY } from './calibration-storage'
import { PRINTER_PROFILES_STORAGE_KEY } from './printer-profiles'

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

const entry = (id: string) =>
  createMeasurementHistoryEntry({
    id,
    profileId: 'profile-1',
    paperSize: 'A4',
    phase: 'calibration',
    axis: 'x',
    targetMm: 50,
    measuredMm: 49.8,
    measuredAt: '2026-10-22T00:00:00.000Z',
  })

describe('measurement history storage', () => {
  it('creates, restores, updates, deletes, and transfers versioned records', () => {
    const local = storage()
    expect(saveMeasurementHistoryEntry(entry('one'), local)).toBe(true)
    expect(
      saveMeasurementHistoryEntry({ ...entry('one'), measuredMm: 49.9 }, local),
    ).toBe(true)
    expect(readMeasurementHistory(local)).toMatchObject([
      { id: 'one', measuredMm: 49.9, version: 1 },
    ])
    const backup = exportMeasurementHistory(local)
    const restored = storage()
    expect(importMeasurementHistory(backup, restored)).toBe(true)
    expect(readMeasurementHistory(restored)).toEqual(
      readMeasurementHistory(local),
    )
    expect(deleteMeasurementHistoryEntry('one', restored)).toBe(true)
    expect(readMeasurementHistory(restored)).toEqual([])
  })

  it('rejects invalid fields and malformed or unsupported imports without replacing data', () => {
    const local = storage()
    expect(
      saveMeasurementHistoryEntry(
        { ...entry('bad'), measuredMm: Infinity },
        local,
      ),
    ).toBe(false)
    expect(importMeasurementHistory('{bad json', local)).toBe(false)
    expect(
      importMeasurementHistory(
        JSON.stringify({ format: 'other', version: 2, measurements: [] }),
        local,
      ),
    ).toBe(false)
    expect(local.getItem(MEASUREMENT_HISTORY_STORAGE_KEY)).toBeNull()
  })

  it('migrates Phase 8 profile and legacy calibration records once and preserves source keys', () => {
    const local = storage({
      [PRINTER_PROFILES_STORAGE_KEY]: JSON.stringify([
        {
          id: 'p1',
          paperSize: 'A4',
          measuredAt: '2026-10-21T12:00:00Z',
          xMeasurements: [{ targetMm: 50, measuredMm: 49.5 }],
          yMeasurements: [],
          verification: {
            measuredAt: '2026-10-22T12:00:00Z',
            xMeasurements: [],
            yMeasurements: [{ targetMm: 100, measuredMm: 100.2 }],
          },
        },
      ]),
      [CALIBRATION_STORAGE_KEY]: JSON.stringify([
        {
          paperSize: 'A4',
          targetMm: 100,
          measuredMm: 99.7,
          savedAt: '2026-10-20T12:00:00Z',
        },
      ]),
    })
    const migrated = readMeasurementHistory(local)
    expect(migrated).toHaveLength(3)
    expect(migrated.map((item) => item.phase)).toEqual([
      'calibration',
      'verification',
      'legacy',
    ])
    expect(migrated.map((item) => item.profileId)).toEqual(['p1', 'p1', 'p1'])
    expect(readMeasurementHistory(local)).toEqual(migrated)
    expect(local.getItem(PRINTER_PROFILES_STORAGE_KEY)).toContain('49.5')
    expect(local.getItem(CALIBRATION_STORAGE_KEY)).toContain('99.7')
  })
})
