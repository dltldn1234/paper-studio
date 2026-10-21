import { CALIBRATION_REFERENCE_LENGTHS } from '../export/calibration'

export type CalibrationAxisMeasurement = {
  targetMm: (typeof CALIBRATION_REFERENCE_LENGTHS)[number]
  measuredMm: number
}

export const MIN_CALIBRATION_SAMPLES = 2
export const MAX_CALIBRATION_MEASURED_RATIO = 2
export const MAX_CALIBRATION_SCALE_SPREAD_PERCENT = 1

export type PrecisionCalibrationStatus =
  'insufficient' | 'invalid' | 'inconsistent' | 'ready'

export type PrecisionCalibrationAnalysis = {
  status: PrecisionCalibrationStatus
  sampleCount: number
  acceptedCount: number
  outlierTargetsMm: number[]
  correctionScale: number | null
  correctionPercent: number | null
  scaleSpreadPercent: number | null
  message: string
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function invalidMeasurement(measurement: CalibrationAxisMeasurement) {
  return (
    !CALIBRATION_REFERENCE_LENGTHS.includes(measurement.targetMm) ||
    !Number.isFinite(measurement.measuredMm) ||
    measurement.measuredMm <= 0 ||
    measurement.measuredMm >
      measurement.targetMm * MAX_CALIBRATION_MEASURED_RATIO
  )
}

/**
 * Estimates printer scale from real reference measurements. At least two
 * distinct reference lengths are required so scale consistency can be checked.
 */
export function analyzeCalibrationAxis(
  measurements: CalibrationAxisMeasurement[],
): PrecisionCalibrationAnalysis {
  if (measurements.some(invalidMeasurement)) {
    return {
      status: 'invalid',
      sampleCount: measurements.length,
      acceptedCount: 0,
      outlierTargetsMm: [],
      correctionScale: null,
      correctionPercent: null,
      scaleSpreadPercent: null,
      message:
        '입력값을 확인하세요. 측정값은 유한한 양수이며 기준 길이의 2배 이하여야 합니다.',
    }
  }

  const targetLengths = new Set(measurements.map(({ targetMm }) => targetMm))
  if (
    measurements.length < MIN_CALIBRATION_SAMPLES ||
    targetLengths.size < MIN_CALIBRATION_SAMPLES
  ) {
    return {
      status: 'insufficient',
      sampleCount: measurements.length,
      acceptedCount: measurements.length,
      outlierTargetsMm: [],
      correctionScale: null,
      correctionPercent: null,
      scaleSpreadPercent: null,
      message:
        '이 축에서 서로 다른 기준 길이를 2개 이상 측정해야 보정값을 계산할 수 있습니다.',
    }
  }

  const samples = measurements.map((measurement) => ({
    ...measurement,
    scale: measurement.targetMm / measurement.measuredMm,
  }))
  const center = median(samples.map(({ scale }) => scale))
  const medianAbsoluteDeviation = median(
    samples.map(({ scale }) => Math.abs(scale - center)),
  )
  const outlierThreshold = Math.max(0.005, 3 * medianAbsoluteDeviation)
  const accepted = samples.filter(
    ({ scale }) => Math.abs(scale - center) <= outlierThreshold,
  )
  const outlierTargetsMm = samples
    .filter(({ scale }) => Math.abs(scale - center) > outlierThreshold)
    .map(({ targetMm }) => targetMm)

  const acceptedTargetLengths = new Set(
    accepted.map(({ targetMm }) => targetMm),
  )
  if (
    accepted.length < MIN_CALIBRATION_SAMPLES ||
    acceptedTargetLengths.size < MIN_CALIBRATION_SAMPLES
  ) {
    return {
      status: 'inconsistent',
      sampleCount: measurements.length,
      acceptedCount: accepted.length,
      outlierTargetsMm,
      correctionScale: null,
      correctionPercent: null,
      scaleSpreadPercent: null,
      message:
        '이상치를 제외한 뒤 서로 다른 기준 길이 2개가 남지 않아 신뢰할 보정값을 계산할 수 없습니다.',
    }
  }

  const acceptedScales = accepted.map(({ scale }) => scale)
  const correctionScale = median(acceptedScales)
  const scaleSpreadPercent =
    ((Math.max(...acceptedScales) - Math.min(...acceptedScales)) /
      correctionScale) *
    100
  if (scaleSpreadPercent > MAX_CALIBRATION_SCALE_SPREAD_PERCENT) {
    return {
      status: 'inconsistent',
      sampleCount: measurements.length,
      acceptedCount: accepted.length,
      outlierTargetsMm,
      correctionScale,
      correctionPercent: (correctionScale - 1) * 100,
      scaleSpreadPercent,
      message:
        '기준 길이 측정값의 차이가 1%를 넘습니다. 출력 배율, 측정 방법, 드라이버 설정을 확인한 뒤 다시 측정하세요.',
    }
  }

  return {
    status: 'ready',
    sampleCount: measurements.length,
    acceptedCount: accepted.length,
    outlierTargetsMm,
    correctionScale,
    correctionPercent: (correctionScale - 1) * 100,
    scaleSpreadPercent,
    message:
      '측정값이 일관되어 배율 보정을 권장합니다. 적용 후 다시 출력해 실제 치수를 확인하세요.',
  }
}

export function canApplyPrinterCorrection(
  profileId: string,
  previouslyAppliedProfileIds: string[],
) {
  return (
    profileId.length > 0 && !previouslyAppliedProfileIds.includes(profileId)
  )
}

export function compareCalibrationMeasurement(
  targetMm: number,
  measuredMm: number,
) {
  if (
    !Number.isFinite(targetMm) ||
    targetMm <= 0 ||
    !Number.isFinite(measuredMm) ||
    measuredMm <= 0
  ) {
    throw new RangeError(
      'Calibration measurements must be finite and positive.',
    )
  }
  return {
    targetMm,
    measuredMm,
    errorMm: measuredMm - targetMm,
    errorPercent: ((measuredMm - targetMm) / targetMm) * 100,
    correctionScale: targetMm / measuredMm,
  }
}
