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
        'Check the entered measurements. Values must be finite, positive, and within a plausible range.',
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
        'Measure at least two different reference lengths on this axis before calculating a correction.',
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

  if (accepted.length < MIN_CALIBRATION_SAMPLES) {
    return {
      status: 'inconsistent',
      sampleCount: measurements.length,
      acceptedCount: accepted.length,
      outlierTargetsMm,
      correctionScale: null,
      correctionPercent: null,
      scaleSpreadPercent: null,
      message:
        'The measurements do not provide enough consistent samples for a reliable correction.',
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
        'Reference lengths disagree by more than 1%. Check printer scaling, measurement technique, and driver settings before using a correction.',
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
      'Measurements are consistent enough to recommend a scale correction. Reprint and measure again to verify it.',
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
