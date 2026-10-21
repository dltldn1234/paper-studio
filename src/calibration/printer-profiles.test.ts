import { describe, expect, it } from 'vitest'
import {
  createPrinterProfile,
  parsePrinterProfileFile,
  serializePrinterProfiles,
} from './printer-profiles'

describe('printer profile file format', () => {
  it('creates distinct empty A4/A3 profiles without claiming verification', () => {
    const a4 = createPrinterProfile({
      id: 'a4',
      name: 'Office A4',
      manufacturer: 'Example',
      model: 'Printer 1',
      driverInfo: 'USB driver',
      paperSize: 'A4',
      orientation: 'portrait',
      now: '2026-10-22T00:00:00.000Z',
    })
    const a3 = createPrinterProfile({
      id: 'a3',
      name: 'Studio A3',
      manufacturer: 'Example',
      model: 'Printer 2',
      driverInfo: 'Network queue',
      paperSize: 'A3',
      orientation: 'landscape',
      now: '2026-10-22T00:00:00.000Z',
    })
    expect(a4).toMatchObject({
      paperSize: 'A4',
      xMeasurements: [],
      yMeasurements: [],
      correction: null,
      verification: null,
    })
    expect(a3.paperSize).toBe('A3')
    expect(parsePrinterProfileFile(serializePrinterProfiles([a4, a3]))).toEqual(
      [a4, a3],
    )
  })

  it('rejects invalid sizes, timestamps, correction factors and file versions', () => {
    const profile = createPrinterProfile({
      id: 'test',
      name: 'Printer',
      manufacturer: '',
      model: '',
      driverInfo: '',
      paperSize: 'A4',
      orientation: 'portrait',
      now: '2026-10-22T00:00:00.000Z',
    })
    const file = JSON.parse(serializePrinterProfiles([profile])) as {
      profiles: Array<Record<string, unknown>>
      version: number
      format: string
    }
    file.profiles[0].xMeasurements = [{ targetMm: 100, measuredMm: 0 }]
    expect(() => parsePrinterProfileFile(JSON.stringify(file))).toThrow(
      'invalid or unsupported',
    )
    expect(() =>
      parsePrinterProfileFile(
        JSON.stringify({ ...file, version: 999, profiles: [profile] }),
      ),
    ).toThrow('invalid or unsupported')
  })
})
