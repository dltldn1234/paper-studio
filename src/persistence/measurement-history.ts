import {
  isMeasurementHistoryEntry,
  parseMeasurementHistoryFile,
  serializeMeasurementHistory,
} from '../calibration/measurement-history'
import type { MeasurementHistoryEntry } from '../calibration/measurement-history'
import { CALIBRATION_STORAGE_KEY } from './calibration-storage'
import { PRINTER_PROFILES_STORAGE_KEY } from './printer-profiles'

export const MEASUREMENT_HISTORY_STORAGE_KEY =
  'paper-studio.measurement-history.v1'
export type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function readRaw(storage: HistoryStorage): MeasurementHistoryEntry[] {
  try {
    const value: unknown = JSON.parse(
      storage.getItem(MEASUREMENT_HISTORY_STORAGE_KEY) ?? '[]',
    )
    return Array.isArray(value) &&
      value.every(isMeasurementHistoryEntry) &&
      new Set(value.map((entry) => entry.id)).size === value.length
      ? value
      : []
  } catch {
    return []
  }
}

function write(
  entries: MeasurementHistoryEntry[],
  storage: HistoryStorage,
): boolean {
  try {
    storage.setItem(MEASUREMENT_HISTORY_STORAGE_KEY, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}

function migratePhase8(storage: HistoryStorage): MeasurementHistoryEntry[] {
  const entries: MeasurementHistoryEntry[] = []
  try {
    const profiles: unknown = JSON.parse(
      storage.getItem(PRINTER_PROFILES_STORAGE_KEY) ?? '[]',
    )
    if (Array.isArray(profiles))
      for (const profile of profiles) {
        if (!profile || typeof profile !== 'object') continue
        const p = profile as Record<string, unknown>
        for (const axis of ['x', 'y'] as const) {
          const measurements = p[`${axis}Measurements`]
          if (!Array.isArray(measurements)) continue
          for (const [index, item] of measurements.entries()) {
            if (!item || typeof item !== 'object') continue
            const measurement = item as Record<string, unknown>
            const entry = {
              id: `phase8-${String(p.id)}-calibration-${axis}-${String(measurement.targetMm)}-${index}`,
              version: 1,
              profileId: typeof p.id === 'string' ? p.id : null,
              paperSize: p.paperSize,
              phase: 'calibration',
              axis,
              targetMm: measurement.targetMm,
              measuredMm: measurement.measuredMm,
              measuredAt:
                typeof p.measuredAt === 'string' ? p.measuredAt : p.updatedAt,
            }
            if (isMeasurementHistoryEntry(entry)) entries.push(entry)
          }
        }
        const verification = p.verification
        if (verification && typeof verification === 'object') {
          const v = verification as Record<string, unknown>
          for (const axis of ['x', 'y'] as const) {
            const measurements = v[`${axis}Measurements`]
            if (!Array.isArray(measurements)) continue
            for (const [index, item] of measurements.entries()) {
              if (!item || typeof item !== 'object') continue
              const measurement = item as Record<string, unknown>
              const entry = {
                id: `phase8-${String(p.id)}-verification-${axis}-${String(measurement.targetMm)}-${index}`,
                version: 1,
                profileId: typeof p.id === 'string' ? p.id : null,
                paperSize: p.paperSize,
                phase: 'verification',
                axis,
                targetMm: measurement.targetMm,
                measuredMm: measurement.measuredMm,
                measuredAt: v.measuredAt,
              }
              if (isMeasurementHistoryEntry(entry)) entries.push(entry)
            }
          }
        }
      }
    const legacy: unknown = JSON.parse(
      storage.getItem(CALIBRATION_STORAGE_KEY) ?? '[]',
    )
    if (Array.isArray(legacy))
      for (const [index, item] of legacy.entries()) {
        if (!item || typeof item !== 'object') continue
        const measurement = item as Record<string, unknown>
        const matching = Array.isArray(profiles)
          ? (profiles.find(
              (p) =>
                p &&
                typeof p === 'object' &&
                (p as Record<string, unknown>).paperSize ===
                  measurement.paperSize,
            ) as Record<string, unknown> | undefined)
          : undefined
        const entry = {
          id: `phase8-legacy-${String(measurement.paperSize)}-${String(measurement.targetMm)}-${index}`,
          version: 1,
          profileId: typeof matching?.id === 'string' ? matching.id : null,
          paperSize: measurement.paperSize,
          phase: 'legacy',
          axis: 'x',
          targetMm: measurement.targetMm,
          measuredMm: measurement.measuredMm,
          measuredAt: measurement.savedAt,
        }
        if (isMeasurementHistoryEntry(entry)) entries.push(entry)
      }
  } catch {
    /* Preserve source keys and migrate only valid entries. */
  }
  return entries
}

export function readMeasurementHistory(
  storage: HistoryStorage | undefined = browserStorage(),
): MeasurementHistoryEntry[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(MEASUREMENT_HISTORY_STORAGE_KEY)
    if (raw !== null) return readRaw(storage)
    const migrated = migratePhase8(storage)
    write(migrated, storage)
    return migrated
  } catch {
    return []
  }
}

export function saveMeasurementHistoryEntry(
  entry: MeasurementHistoryEntry,
  storage: HistoryStorage | undefined = browserStorage(),
): boolean {
  if (!storage || !isMeasurementHistoryEntry(entry)) return false
  const current = readMeasurementHistory(storage)
  return write(
    [...current.filter((item) => item.id !== entry.id), entry],
    storage,
  )
}

export function deleteMeasurementHistoryEntry(
  id: string,
  storage: HistoryStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false
  const current = readMeasurementHistory(storage)
  const next = current.filter((item) => item.id !== id)
  return next.length !== current.length && write(next, storage)
}

export function exportMeasurementHistory(
  storage: HistoryStorage | undefined = browserStorage(),
): string {
  return serializeMeasurementHistory(readMeasurementHistory(storage))
}

export function importMeasurementHistory(
  json: string,
  storage: HistoryStorage | undefined = browserStorage(),
): boolean {
  if (!storage) return false
  try {
    const imported = parseMeasurementHistoryFile(json)
    const merged = new Map(
      readMeasurementHistory(storage).map((entry) => [entry.id, entry]),
    )
    for (const entry of imported) merged.set(entry.id, entry)
    return write([...merged.values()], storage)
  } catch {
    return false
  }
}
