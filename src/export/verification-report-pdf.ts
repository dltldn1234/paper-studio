import { PDFDocument, PrintScaling, StandardFonts, rgb } from 'pdf-lib'
import type { VerificationReport } from '../calibration/verification-report'
import { mmToPdfPoints, PDF_POINTS_PER_MM } from './pdf-units'

const PAGE_WIDTH = mmToPdfPoints(210)
const PAGE_HEIGHT = mmToPdfPoints(297)
const MARGIN = mmToPdfPoints(16)

function signedMm(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} mm`
}

export async function createVerificationReportPdf(
  report: VerificationReport,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Verification report - ${report.printer.name}`)
  pdf.setCreator('Paper Studio')
  pdf.setSubject('Printer calibration measurement summary')
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN
  const textColor = rgb(0.12, 0.18, 0.27)
  const muted = rgb(0.35, 0.4, 0.47)
  const warning = rgb(0.62, 0.27, 0.08)

  const line = (
    text: string,
    options: { bold?: boolean; color?: typeof textColor; size?: number } = {},
  ) => {
    if (y < MARGIN + mmToPdfPoints(14)) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN
    }
    page.drawText(text.slice(0, 150).replace(/[^\x20-\x7E]/g, '?'), {
      x: MARGIN,
      y,
      size: options.size ?? 9,
      font: options.bold ? bold : font,
      color: options.color ?? textColor,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
    })
    y -= mmToPdfPoints(options.size && options.size > 12 ? 9 : 6)
  }

  line('PAPER STUDIO VERIFICATION REPORT', { bold: true, size: 15 })
  line(`Generated: ${report.generatedAt}`, { color: muted })
  line('PRINTER AND OUTPUT SETTINGS', { bold: true, size: 11 })
  line(
    `Printer: ${report.printer.name} (${report.printer.manufacturer} ${report.printer.model})`,
  )
  line(`Driver / output path: ${report.printer.driverInfo || 'Not recorded'}`)
  line(`Paper: ${report.printer.paperSize} ${report.printer.orientation}`)
  line(
    `Correction: ${report.printer.correction ? `X ${(report.printer.correction.xScale * 100).toFixed(2)}%, Y ${(report.printer.correction.yScale * 100).toFixed(2)}%` : 'None'}`,
  )
  line('VERIFICATION STATUS', { bold: true, size: 11 })
  line(`Status: ${report.verification.status}`)
  line(
    `Physical measurements entered: ${report.verification.physicallyMeasured ? 'Yes' : 'No'}`,
  )
  line(
    `Verification measured at: ${report.verification.measuredAt ?? 'Not recorded'}`,
  )
  line('STATISTICS', { bold: true, size: 11 })
  const statLine = (
    label: string,
    stats: VerificationReport['statistics']['overall'],
  ) =>
    line(
      `${label}: ${stats ? `n=${stats.sampleCount}, mean ${signedMm(stats.meanErrorMm)}, MAE ${stats.meanAbsoluteErrorMm.toFixed(2)} mm, SD ${stats.standardDeviationMm.toFixed(2)} mm, range ${signedMm(stats.minimumErrorMm)} to ${signedMm(stats.maximumErrorMm)}` : 'No measurements'}`,
    )
  statLine('Overall', report.statistics.overall)
  statLine('Before calibration', report.statistics.calibration)
  statLine('After calibration', report.statistics.verification)
  statLine('X axis', report.statistics.xAxis)
  statLine('Y axis', report.statistics.yAxis)
  const outlierCount = report.statistics.overall?.outlierIds.length ?? 0
  line(
    `Warnings: ${report.statistics.overall && report.statistics.overall.sampleCount < 3 ? 'fewer than 3 measurements; repeat measurements recommended' : 'none for sample count'}; ${outlierCount} outliers retained in history`,
    { color: warning },
  )
  line('PROFILE CALIBRATION COMPARISON', { bold: true, size: 11 })
  for (const axis of ['x', 'y'] as const) {
    const before = report.profileComparison.before[axis]
    const after = report.profileComparison.after[axis]
    line(
      `${axis.toUpperCase()} axis profile measurements: before ${before ? `${before.sampleCount} samples, MAE ${before.meanAbsoluteErrorMm.toFixed(2)} mm` : 'none'}; after ${after ? `${after.sampleCount} samples, MAE ${after.meanAbsoluteErrorMm.toFixed(2)} mm` : 'none'}`,
    )
  }
  line(
    `Profile mean absolute error improvement: ${report.profileComparison.improvementMm === null ? 'Not comparable' : signedMm(report.profileComparison.improvementMm)}`,
  )
  line(
    `Mean absolute error improvement: ${report.statistics.improvementMm === null ? 'Not comparable' : signedMm(report.statistics.improvementMm)}`,
  )
  line('MEASUREMENT RECORDS', { bold: true, size: 11 })
  if (!report.measurements.length)
    line('No measurement history is linked to this printer profile.')
  for (const entry of report.measurements) {
    line(
      `${entry.measuredAt} | ${entry.phase} | ${entry.printerName ?? report.printer.name} ${entry.manufacturer ?? ''} ${entry.model ?? ''} | ${entry.paperSize} ${entry.orientation ?? 'orientation unknown'} | driver ${entry.driverInfo ?? 'not recorded'}`,
      { size: 8 },
    )
    line(
      `  ${entry.axis.toUpperCase()} axis | target ${entry.targetMm} mm | measured ${entry.measuredMm.toFixed(2)} mm | error ${signedMm(entry.errorMm)} (${entry.errorRatePercent.toFixed(2)}%)`,
      { size: 8 },
    )
  }
  line('LIMITATIONS', { bold: true, size: 11, color: warning })
  for (const limitation of report.limitations)
    line(`- ${limitation}`, { color: warning, size: 8 })

  pdf.getPages().forEach((reportPage, index) => {
    reportPage.drawText(`Page ${index + 1}`, {
      x: PAGE_WIDTH - MARGIN - mmToPdfPoints(18),
      y: MARGIN,
      size: 8,
      font,
      color: muted,
    })
  })
  if (Math.abs(PAGE_WIDTH / PDF_POINTS_PER_MM - 210) > 0.001) {
    throw new RangeError('Verification report page size is invalid.')
  }
  return pdf.save()
}
