import { PDFDocument, PrintScaling } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { createMeasurementHistoryEntry } from '../calibration/measurement-history'
import { createPrinterProfile } from '../calibration/printer-profiles'
import { createVerificationReport } from '../calibration/verification-report'
import { createVerificationReportPdf } from './verification-report-pdf'

describe('verification report PDF', () => {
  it('creates a paginated, actual-size A4 report and keeps unmeasured status explicit', async () => {
    const profile = createPrinterProfile({
      id: 'report-printer',
      name: 'Workshop printer',
      manufacturer: 'PaperCo',
      model: 'P-1',
      driverInfo: 'Desk driver',
      paperSize: 'A3',
      orientation: 'landscape',
      now: '2026-10-22T00:00:00.000Z',
    })
    const measurements = Array.from({ length: 80 }, (_, index) =>
      createMeasurementHistoryEntry({
        id: `measurement-${index}`,
        profileId: profile.id,
        paperSize: 'A3',
        phase: index % 2 === 0 ? 'calibration' : 'verification',
        axis: index % 2 === 0 ? 'x' : 'y',
        targetMm: 50,
        measuredMm: 49.5 + (index % 10) / 10,
        measuredAt: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
      }),
    )
    const report = createVerificationReport(
      profile,
      measurements,
      '2026-10-22T00:00:00.000Z',
    )
    const bytes = await createVerificationReportPdf(report)
    const pdf = await PDFDocument.load(bytes)
    const pages = pdf.getPages()

    expect(pages.length).toBeGreaterThan(1)
    expect(pages[0].getSize().width / (72 / 25.4)).toBeCloseTo(210, 1)
    expect(pages[0].getSize().height / (72 / 25.4)).toBeCloseTo(297, 1)
    expect(pdf.getTitle()).toContain('Workshop printer')
    expect(pdf.catalog.getOrCreateViewerPreferences().getPrintScaling()).toBe(
      PrintScaling.None,
    )
    expect(report.verification.status).toBe('unverified')
    expect(report.verification.physicallyMeasured).toBe(false)
  })
})
