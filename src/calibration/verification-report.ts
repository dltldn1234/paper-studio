import {
  analyzeAccuracy,
  buildAccuracySamples,
  compareCalibrationPhases,
} from './statistics'
import type { AccuracyStatistics } from './statistics'
import { isMeasurementHistoryEntry } from './measurement-history'
import type { MeasurementHistoryEntry } from './measurement-history'
import { isPrinterProfile } from './printer-profiles'
import type { PrinterProfile } from './printer-profiles'

export const VERIFICATION_REPORT_FORMAT = 'paper-studio-verification-report'
export const VERIFICATION_REPORT_VERSION = 1

export type VerificationReport = {
  format: typeof VERIFICATION_REPORT_FORMAT
  version: typeof VERIFICATION_REPORT_VERSION
  generatedAt: string
  printer: {
    id: string
    name: string
    manufacturer: string
    model: string
    driverInfo: string
    paperSize: PrinterProfile['paperSize']
    orientation: PrinterProfile['orientation']
    correction: PrinterProfile['correction']
  }
  verification: {
    status: 'verified' | 'needs-review' | 'unverified'
    physicallyMeasured: boolean
    measuredAt: string | null
    xMeasurements: PrinterProfile['xMeasurements']
    yMeasurements: PrinterProfile['yMeasurements']
  }
  measurements: Array<{
    id: string
    phase: MeasurementHistoryEntry['phase']
    axis: MeasurementHistoryEntry['axis']
    paperSize: MeasurementHistoryEntry['paperSize']
    targetMm: MeasurementHistoryEntry['targetMm']
    measuredMm: number
    errorMm: number
    errorRatePercent: number
    measuredAt: string
    printerName?: string
    manufacturer?: string
    model?: string
    driverInfo?: string
    orientation?: MeasurementHistoryEntry['orientation']
  }>
  statistics: {
    overall: AccuracyStatistics | null
    calibration: AccuracyStatistics | null
    verification: AccuracyStatistics | null
    xAxis: AccuracyStatistics | null
    yAxis: AccuracyStatistics | null
    improvementMm: number | null
  }
  profileComparison: {
    before: Record<
      'x' | 'y',
      { sampleCount: number; meanAbsoluteErrorMm: number } | null
    >
    after: Record<
      'x' | 'y',
      { sampleCount: number; meanAbsoluteErrorMm: number } | null
    >
    improvementMm: number | null
  }
  limitations: string[]
}

function summarize(samples: ReturnType<typeof buildAccuracySamples>) {
  const overall = analyzeAccuracy(samples)
  const calibration = analyzeAccuracy(
    samples.filter(({ phase }) => phase === 'calibration'),
  )
  const verification = analyzeAccuracy(
    samples.filter(({ phase }) => phase === 'verification'),
  )
  return {
    overall,
    calibration,
    verification,
    xAxis: analyzeAccuracy(samples.filter(({ axis }) => axis === 'x')),
    yAxis: analyzeAccuracy(samples.filter(({ axis }) => axis === 'y')),
    improvementMm: compareCalibrationPhases(samples)?.improvementMm ?? null,
  }
}

function summarizeAxisMeasurements(
  measurements: PrinterProfile['xMeasurements'],
) {
  if (measurements.length === 0) return null
  return {
    sampleCount: measurements.length,
    meanAbsoluteErrorMm:
      measurements.reduce(
        (sum, measurement) =>
          sum + Math.abs(measurement.measuredMm - measurement.targetMm),
        0,
      ) / measurements.length,
  }
}

export function createVerificationReport(
  profile: PrinterProfile,
  history: MeasurementHistoryEntry[],
  generatedAt = new Date().toISOString(),
): VerificationReport {
  if (!isPrinterProfile(profile) || !Number.isFinite(Date.parse(generatedAt))) {
    throw new RangeError('Verification report inputs are invalid.')
  }
  const validHistory = history.filter(
    (entry) =>
      isMeasurementHistoryEntry(entry) && entry.profileId === profile.id,
  )
  const samples = buildAccuracySamples(validHistory, [profile])
  const storedVerification = profile.verification
  const before = {
    x: summarizeAxisMeasurements(profile.xMeasurements),
    y: summarizeAxisMeasurements(profile.yMeasurements),
  }
  const after = {
    x: summarizeAxisMeasurements(storedVerification?.xMeasurements ?? []),
    y: summarizeAxisMeasurements(storedVerification?.yMeasurements ?? []),
  }
  const beforeAxes = [before.x, before.y].filter(
    (item): item is NonNullable<typeof item> => item !== null,
  )
  const afterAxes = [after.x, after.y].filter(
    (item): item is NonNullable<typeof item> => item !== null,
  )
  const beforeMean = beforeAxes.length
    ? beforeAxes.reduce(
        (sum, item) => sum + item.meanAbsoluteErrorMm * item.sampleCount,
        0,
      ) / beforeAxes.reduce((sum, item) => sum + item.sampleCount, 0)
    : null
  const afterMean = afterAxes.length
    ? afterAxes.reduce(
        (sum, item) => sum + item.meanAbsoluteErrorMm * item.sampleCount,
        0,
      ) / afterAxes.reduce((sum, item) => sum + item.sampleCount, 0)
    : null
  return {
    format: VERIFICATION_REPORT_FORMAT,
    version: VERIFICATION_REPORT_VERSION,
    generatedAt,
    printer: {
      id: profile.id,
      name: profile.name,
      manufacturer: profile.manufacturer,
      model: profile.model,
      driverInfo: profile.driverInfo,
      paperSize: profile.paperSize,
      orientation: profile.orientation,
      correction: profile.correction,
    },
    verification: {
      status: storedVerification?.status ?? 'unverified',
      physicallyMeasured: storedVerification?.physicallyMeasured ?? false,
      measuredAt: storedVerification?.measuredAt ?? null,
      xMeasurements: storedVerification?.xMeasurements ?? [],
      yMeasurements: storedVerification?.yMeasurements ?? [],
    },
    measurements: samples.map((sample) => ({
      id: sample.id,
      phase: sample.phase,
      axis: sample.axis,
      paperSize: sample.paperSize,
      targetMm: sample.targetMm,
      measuredMm: sample.measuredMm,
      errorMm: sample.errorMm,
      errorRatePercent: sample.errorRatePercent,
      measuredAt: sample.measuredAt,
      printerName: sample.printerName,
      manufacturer: sample.manufacturer,
      model: sample.model,
      driverInfo: sample.driverInfo,
      orientation:
        sample.orientation === 'unknown' ? undefined : sample.orientation,
    })),
    statistics: summarize(samples),
    profileComparison: {
      before,
      after,
      improvementMm:
        beforeMean === null || afterMean === null
          ? null
          : beforeMean - afterMean,
    },
    limitations: [
      'This report summarizes user-entered measurements and software calculations.',
      'Software cannot validate physical printer output without measurements from printed sheets.',
      'Paper, printer, driver, scaling, and environmental changes may require re-verification.',
      'Older measurement history may not contain printer, driver, or orientation snapshots.',
    ],
  }
}

export function serializeVerificationReport(report: VerificationReport) {
  return JSON.stringify(
    parseVerificationReport(JSON.stringify(report)),
    null,
    2,
  )
}

export function parseVerificationReport(json: string): VerificationReport {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch (error) {
    throw new RangeError('Verification report JSON could not be read.', {
      cause: error,
    })
  }
  if (
    !value ||
    typeof value !== 'object' ||
    (value as VerificationReport).format !== VERIFICATION_REPORT_FORMAT ||
    (value as VerificationReport).version !== VERIFICATION_REPORT_VERSION ||
    !Number.isFinite(Date.parse((value as VerificationReport).generatedAt)) ||
    !(value as VerificationReport).printer ||
    typeof (value as VerificationReport).printer.id !== 'string' ||
    !Array.isArray((value as VerificationReport).measurements) ||
    !(value as VerificationReport).measurements.every(
      (entry) =>
        typeof entry.id === 'string' &&
        Number.isFinite(entry.measuredMm) &&
        Number.isFinite(entry.errorMm) &&
        Number.isFinite(entry.errorRatePercent) &&
        Number.isFinite(Date.parse(entry.measuredAt)),
    ) ||
    !Array.isArray((value as VerificationReport).limitations)
  ) {
    throw new RangeError('Verification report format or fields are invalid.')
  }
  return value as VerificationReport
}
