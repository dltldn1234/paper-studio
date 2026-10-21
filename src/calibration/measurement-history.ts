import { CALIBRATION_REFERENCE_LENGTHS } from '../export/calibration'
import type { CalibrationReferenceLength } from '../export/calibration'
import type { PaperSize } from '../export/print-layout'

export const MEASUREMENT_HISTORY_FORMAT = 'paper-studio-measurement-history'
export const MEASUREMENT_HISTORY_VERSION = 1

export type MeasurementHistoryEntry = {
  id: string
  version: typeof MEASUREMENT_HISTORY_VERSION
  profileId: string | null
  paperSize: PaperSize
  phase: 'calibration' | 'verification' | 'legacy'
  axis: 'x' | 'y'
  targetMm: CalibrationReferenceLength
  measuredMm: number
  measuredAt: string
}

export type MeasurementHistoryFile = {
  format: typeof MEASUREMENT_HISTORY_FORMAT
  version: typeof MEASUREMENT_HISTORY_VERSION
  measurements: MeasurementHistoryEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isMeasurementHistoryEntry(
  value: unknown,
): value is MeasurementHistoryEntry {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    value.version === MEASUREMENT_HISTORY_VERSION &&
    (value.profileId === null ||
      (typeof value.profileId === 'string' && value.profileId.length > 0)) &&
    (value.paperSize === 'A4' || value.paperSize === 'A3') &&
    (value.phase === 'calibration' ||
      value.phase === 'verification' ||
      value.phase === 'legacy') &&
    (value.axis === 'x' || value.axis === 'y') &&
    CALIBRATION_REFERENCE_LENGTHS.includes(
      value.targetMm as CalibrationReferenceLength,
    ) &&
    typeof value.measuredMm === 'number' &&
    Number.isFinite(value.measuredMm) &&
    value.measuredMm > 0 &&
    value.measuredMm <= Number(value.targetMm) * 2 &&
    typeof value.measuredAt === 'string' &&
    Number.isFinite(Date.parse(value.measuredAt))
  )
}

export function createMeasurementHistoryEntry(
  input: Omit<MeasurementHistoryEntry, 'id' | 'version'> & { id?: string },
): MeasurementHistoryEntry {
  const entry: MeasurementHistoryEntry = {
    ...input,
    id:
      input.id ??
      globalThis.crypto?.randomUUID?.() ??
      `measurement-${Date.now()}`,
    version: MEASUREMENT_HISTORY_VERSION,
  }
  if (!isMeasurementHistoryEntry(entry))
    throw new RangeError('측정 이력 입력값이 올바르지 않습니다.')
  return entry
}

export function parseMeasurementHistoryFile(
  json: string,
): MeasurementHistoryEntry[] {
  try {
    const file: unknown = JSON.parse(json)
    if (
      !isRecord(file) ||
      file.format !== MEASUREMENT_HISTORY_FORMAT ||
      file.version !== MEASUREMENT_HISTORY_VERSION ||
      !Array.isArray(file.measurements) ||
      !file.measurements.every(isMeasurementHistoryEntry) ||
      new Set(file.measurements.map((entry) => entry.id)).size !==
        file.measurements.length
    ) {
      throw new RangeError(
        '지원하지 않거나 올바르지 않은 측정 이력 파일입니다.',
      )
    }
    return file.measurements
  } catch (error) {
    if (error instanceof RangeError) throw error
    throw new RangeError('측정 이력 JSON을 읽을 수 없습니다.', { cause: error })
  }
}

export function serializeMeasurementHistory(
  entries: MeasurementHistoryEntry[],
) {
  if (
    !entries.every(isMeasurementHistoryEntry) ||
    new Set(entries.map((entry) => entry.id)).size !== entries.length
  ) {
    throw new RangeError('측정 이력에 올바르지 않은 값이 있습니다.')
  }
  const file: MeasurementHistoryFile = {
    format: MEASUREMENT_HISTORY_FORMAT,
    version: MEASUREMENT_HISTORY_VERSION,
    measurements: entries,
  }
  return JSON.stringify(file, null, 2)
}
