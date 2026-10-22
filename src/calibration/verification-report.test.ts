import { describe, expect, it } from 'vitest'
import { createMeasurementHistoryEntry } from './measurement-history'
import { createPrinterProfile } from './printer-profiles'
import {
  createVerificationReport,
  parseVerificationReport,
  serializeVerificationReport,
} from './verification-report'

const NOW = '2026-10-22T00:00:00.000Z'

function profile() {
  return createPrinterProfile({
    id: 'printer-one',
    name: 'Workshop printer',
    manufacturer: 'PaperCo',
    model: 'P-1',
    driverInfo: 'USB · studio',
    paperSize: 'A4',
    orientation: 'portrait',
    now: NOW,
  })
}

function record(
  id: string,
  phase: 'calibration' | 'verification',
  axis: 'x' | 'y',
  targetMm: 50 | 100,
  measuredMm: number,
  profileId = 'printer-one',
) {
  return createMeasurementHistoryEntry({
    id,
    profileId,
    paperSize: 'A4',
    phase,
    axis,
    targetMm,
    measuredMm,
    measuredAt: NOW,
    printerName: 'Workshop printer',
    manufacturer: 'PaperCo',
    model: 'P-1',
    driverInfo: 'USB · studio',
    orientation: 'portrait',
  })
}

describe('verification reports', () => {
  it('reuses linked history and includes statistics and output conditions', () => {
    const target = profile()
    const report = createVerificationReport(
      target,
      [
        record('before-x', 'calibration', 'x', 50, 51),
        record('before-y', 'calibration', 'y', 50, 51),
        record('after-x', 'verification', 'x', 50, 50.1),
        record('other-printer', 'verification', 'y', 50, 49, 'printer-two'),
      ],
      NOW,
    )

    expect(report.printer).toMatchObject({
      id: 'printer-one',
      driverInfo: 'USB · studio',
      paperSize: 'A4',
    })
    expect(report.measurements.map(({ id }) => id)).toEqual([
      'before-x',
      'before-y',
      'after-x',
    ])
    expect(report.measurements[0]).toMatchObject({
      driverInfo: 'USB · studio',
      orientation: 'portrait',
    })
    expect(report.statistics.overall?.sampleCount).toBe(3)
    expect(report.statistics.calibration?.sampleCount).toBe(2)
    expect(report.statistics.verification?.sampleCount).toBe(1)
    expect(report.statistics.improvementMm).toBeCloseTo(0.9)
    expect(report.verification.status).toBe('unverified')
    expect(report.verification.physicallyMeasured).toBe(false)
    expect(report.limitations.join(' ')).toMatch(
      /cannot validate physical printer output/i,
    )
  })

  it('serializes and validates an exportable report without changing its format', () => {
    const report = createVerificationReport(profile(), [], NOW)
    const serialized = serializeVerificationReport(report)
    expect(parseVerificationReport(serialized)).toEqual(report)
    expect(() => parseVerificationReport('{bad json')).toThrow(
      'Verification report JSON could not be read.',
    )
    expect(() => parseVerificationReport('{"format":"other"}')).toThrow(
      'Verification report format or fields are invalid.',
    )
  })

  it('preserves a verified status only when the profile has explicit physical measurements', () => {
    const verifiedProfile = {
      ...profile(),
      xMeasurements: [
        { targetMm: 50 as const, measuredMm: 51 },
        { targetMm: 100 as const, measuredMm: 102 },
      ],
      yMeasurements: [{ targetMm: 50 as const, measuredMm: 49 }],
      verification: {
        measuredAt: NOW,
        xMeasurements: [
          { targetMm: 50 as const, measuredMm: 50.1 },
          { targetMm: 100 as const, measuredMm: 100.2 },
        ],
        yMeasurements: [
          { targetMm: 50 as const, measuredMm: 49.9 },
          { targetMm: 100 as const, measuredMm: 99.8 },
        ],
        physicallyMeasured: true,
        status: 'verified' as const,
      },
    }
    const report = createVerificationReport(verifiedProfile, [], NOW)
    expect(report.verification).toMatchObject({
      status: 'verified',
      physicallyMeasured: true,
    })
    expect(report.profileComparison.before.x?.meanAbsoluteErrorMm).toBe(1.5)
    expect(report.profileComparison.after.x?.meanAbsoluteErrorMm).toBeCloseTo(
      0.15,
    )
    expect(report.profileComparison.improvementMm).toBeCloseTo(1.1833, 3)
  })
})
