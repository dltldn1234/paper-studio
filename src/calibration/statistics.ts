import { isMeasurementHistoryEntry } from './measurement-history'
import type { MeasurementHistoryEntry } from './measurement-history'
import type { PrinterProfile } from './printer-profiles'

export const MIN_STATISTICAL_SAMPLES = 3

export type AccuracySample = MeasurementHistoryEntry & {
  errorMm: number
  errorRatePercent: number
  printerLabel: string
  driverInfo: string
}

export type AccuracyStatistics = {
  sampleCount: number
  meanErrorMm: number
  meanAbsoluteErrorMm: number
  meanErrorRatePercent: number
  standardDeviationMm: number
  minimumErrorMm: number
  maximumErrorMm: number
  outlierIds: string[]
  trend: 'improving' | 'worsening' | 'stable' | 'insufficient'
}

export type StatisticsFilters = {
  profileId?: string
  paperSize?: MeasurementHistoryEntry['paperSize'] | 'all'
  driverInfo?: string | 'all'
  phase?: MeasurementHistoryEntry['phase'] | 'all'
  axis?: MeasurementHistoryEntry['axis'] | 'all'
}

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2
}

export function buildAccuracySamples(
  entries: MeasurementHistoryEntry[],
  profiles: PrinterProfile[],
): AccuracySample[] {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))
  return entries.filter(isMeasurementHistoryEntry).map((entry) => {
    const profile = entry.profileId
      ? profileMap.get(entry.profileId)
      : undefined
    const errorMm = entry.measuredMm - entry.targetMm
    return {
      ...entry,
      errorMm,
      errorRatePercent: (errorMm / entry.targetMm) * 100,
      printerLabel: profile
        ? [profile.manufacturer, profile.model].filter(Boolean).join(' ') ||
          profile.name
        : '연결된 프로필 없음',
      driverInfo: profile?.driverInfo ?? '드라이버 정보 없음',
    }
  })
}

export function filterAccuracySamples(
  samples: AccuracySample[],
  filters: StatisticsFilters = {},
): AccuracySample[] {
  return samples.filter(
    (sample) =>
      (!filters.profileId || sample.profileId === filters.profileId) &&
      (!filters.paperSize ||
        filters.paperSize === 'all' ||
        sample.paperSize === filters.paperSize) &&
      (!filters.driverInfo ||
        filters.driverInfo === 'all' ||
        sample.driverInfo === filters.driverInfo) &&
      (!filters.phase ||
        filters.phase === 'all' ||
        sample.phase === filters.phase) &&
      (!filters.axis || filters.axis === 'all' || sample.axis === filters.axis),
  )
}

/** Computes descriptive sample statistics without mutating or removing records. */
export function analyzeAccuracy(
  samples: AccuracySample[],
): AccuracyStatistics | null {
  if (samples.length === 0) return null
  const errors = samples.map(({ errorMm }) => errorMm)
  const meanErrorMm =
    errors.reduce((sum, error) => sum + error, 0) / errors.length
  const meanAbsoluteErrorMm =
    errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length
  const variance =
    errors.length > 1
      ? errors.reduce((sum, error) => sum + (error - meanErrorMm) ** 2, 0) /
        (errors.length - 1)
      : 0
  const center = median(errors)
  const mad = median(errors.map((error) => Math.abs(error - center)))
  const threshold = Math.max(0.5, 3 * 1.4826 * mad)
  const outlierIds = samples
    .filter(({ errorMm }) => Math.abs(errorMm - center) > threshold)
    .map(({ id }) => id)
  const ordered = [...samples].sort(
    (a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt),
  )
  let trend: AccuracyStatistics['trend'] = 'insufficient'
  if (ordered.length >= MIN_STATISTICAL_SAMPLES) {
    const half = Math.floor(ordered.length / 2)
    const earlier = ordered.slice(0, half)
    const later = ordered.slice(-half)
    const meanAbs = (values: AccuracySample[]) =>
      values.reduce((sum, { errorMm }) => sum + Math.abs(errorMm), 0) /
      values.length
    const change = meanAbs(later) - meanAbs(earlier)
    trend =
      Math.abs(change) < 0.1 ? 'stable' : change < 0 ? 'improving' : 'worsening'
  }
  return {
    sampleCount: samples.length,
    meanErrorMm,
    meanAbsoluteErrorMm,
    meanErrorRatePercent:
      samples.reduce((sum, sample) => sum + sample.errorRatePercent, 0) /
      samples.length,
    standardDeviationMm: Math.sqrt(variance),
    minimumErrorMm: Math.min(...errors),
    maximumErrorMm: Math.max(...errors),
    outlierIds,
    trend,
  }
}

export function compareCalibrationPhases(samples: AccuracySample[]) {
  const before = analyzeAccuracy(
    samples.filter(({ phase }) => phase === 'calibration'),
  )
  const after = analyzeAccuracy(
    samples.filter(({ phase }) => phase === 'verification'),
  )
  if (!before || !after) return null
  return {
    beforeMeanAbsoluteErrorMm: before.meanAbsoluteErrorMm,
    afterMeanAbsoluteErrorMm: after.meanAbsoluteErrorMm,
    improvementMm: before.meanAbsoluteErrorMm - after.meanAbsoluteErrorMm,
  }
}
