import { describe, expect, it } from 'vitest'
import { createPrinterProfile } from '../calibration/printer-profiles'
import {
  deletePrinterProfile,
  exportPrinterProfiles,
  importPrinterProfiles,
  PRINTER_PROFILES_STORAGE_KEY,
  readPrinterProfiles,
  savePrinterProfile,
  setDefaultPrinterProfile,
} from './printer-profiles'

function fakeStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

function profile(id: string, paperSize: 'A4' | 'A3' = 'A4') {
  return createPrinterProfile({
    id,
    name: id,
    manufacturer: 'Maker',
    model: 'Model',
    driverInfo: 'Driver',
    paperSize,
    orientation: 'portrait',
    now: '2026-10-22T00:00:00.000Z',
  })
}

describe('local printer profiles', () => {
  it('creates, updates, defaults, exports, imports and deletes profiles', () => {
    const storage = fakeStorage()
    expect(savePrinterProfile(profile('a4'), storage)).toBe(true)
    expect(savePrinterProfile(profile('a4b'), storage)).toBe(true)
    expect(savePrinterProfile(profile('a3', 'A3'), storage)).toBe(true)
    expect(setDefaultPrinterProfile('a4', storage)).toBe(true)
    expect(setDefaultPrinterProfile('a4b', storage)).toBe(true)
    expect(
      readPrinterProfiles(storage).filter((item) => item.isDefault),
    ).toEqual([expect.objectContaining({ id: 'a4b', paperSize: 'A4' })])

    const exported = exportPrinterProfiles(storage)
    const anotherStorage = fakeStorage()
    expect(importPrinterProfiles(exported, anotherStorage)).toBe(true)
    expect(readPrinterProfiles(anotherStorage)).toHaveLength(3)
    expect(deletePrinterProfile('a4', storage)).toBe(true)
    expect(readPrinterProfiles(storage).map((item) => item.id)).toEqual([
      'a4b',
      'a3',
    ])
  })

  it('preserves the Phase 7 calibration key and rejects invalid profile JSON', () => {
    const storage = fakeStorage()
    storage.setItem(
      'paper-studio.print-calibration.v1',
      JSON.stringify([{ paperSize: 'A4', targetMm: 100, measuredMm: 99 }]),
    )
    expect(importPrinterProfiles('{broken', storage)).toBe(false)
    expect(storage.getItem('paper-studio.print-calibration.v1')).toContain(
      'measuredMm',
    )
    expect(storage.getItem(PRINTER_PROFILES_STORAGE_KEY)).toBeNull()
  })
})
