import { CALIBRATION_REFERENCE_LENGTHS } from '../export/calibration'
import type { CalibrationReferenceLength } from '../export/calibration'
import type { PaperSize } from '../export/print-layout'

export const CALIBRATION_STORAGE_KEY = 'paper-studio.print-calibration.v1'

export type StoredCalibrationMeasurement = {
  paperSize: PaperSize
  targetMm: CalibrationReferenceLength
  measuredMm: number
  savedAt: string
}

type CalibrationStorage = Pick<Storage, 'getItem' | 'setItem'>

function isStoredMeasurement(
  value: unknown,
): value is StoredCalibrationMeasurement {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    (record.paperSize === 'A4' || record.paperSize === 'A3') &&
    CALIBRATION_REFERENCE_LENGTHS.includes(
      record.targetMm as CalibrationReferenceLength,
    ) &&
    typeof record.measuredMm === 'number' &&
    Number.isFinite(record.measuredMm) &&
    record.measuredMm > 0 &&
    typeof record.savedAt === 'string'
  )
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export function readCalibrationMeasurements(
  storage: CalibrationStorage | undefined = browserStorage(),
): StoredCalibrationMeasurement[] {
  if (!storage) return []
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(CALIBRATION_STORAGE_KEY) ?? '[]',
    )
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStoredMeasurement)
  } catch {
    return []
  }
}

export function saveCalibrationMeasurement(
  measurement: StoredCalibrationMeasurement,
  storage: CalibrationStorage | undefined = browserStorage(),
) {
  if (!storage || !isStoredMeasurement(measurement)) return false
  const current = readCalibrationMeasurements(storage)
  const next = current.filter(
    (item) =>
      item.paperSize !== measurement.paperSize ||
      item.targetMm !== measurement.targetMm,
  )
  next.push(measurement)
  try {
    storage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}

export function removeCalibrationMeasurement(
  paperSize: PaperSize,
  targetMm: CalibrationReferenceLength,
  storage: CalibrationStorage | undefined = browserStorage(),
) {
  if (!storage) return false
  const next = readCalibrationMeasurements(storage).filter(
    (item) => item.paperSize !== paperSize || item.targetMm !== targetMm,
  )
  try {
    storage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(next))
    return true
  } catch {
    return false
  }
}
