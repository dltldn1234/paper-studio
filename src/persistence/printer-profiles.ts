import {
  isPrinterProfile,
  parsePrinterProfileFile,
  serializePrinterProfiles,
} from '../calibration/printer-profiles'
import type { PrinterProfile } from '../calibration/printer-profiles'

export const PRINTER_PROFILES_STORAGE_KEY = 'paper-studio.printer-profiles.v1'

type ProfileStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

export function readPrinterProfiles(
  storage: ProfileStorage | undefined = browserStorage(),
): PrinterProfile[] {
  if (!storage) return []
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(PRINTER_PROFILES_STORAGE_KEY) ?? '[]',
    )
    if (!Array.isArray(parsed) || !parsed.every(isPrinterProfile)) return []
    if (new Set(parsed.map((profile) => profile.id)).size !== parsed.length)
      return []
    return parsed
  } catch {
    return []
  }
}

function writeProfiles(profiles: PrinterProfile[], storage: ProfileStorage) {
  try {
    storage.setItem(PRINTER_PROFILES_STORAGE_KEY, JSON.stringify(profiles))
    return true
  } catch {
    return false
  }
}

export function savePrinterProfile(
  profile: PrinterProfile,
  storage: ProfileStorage | undefined = browserStorage(),
) {
  if (!storage || !isPrinterProfile(profile)) return false
  const current = readPrinterProfiles(storage)
  const next = current
    .filter((item) => item.id !== profile.id)
    .map((item) =>
      profile.isDefault && item.paperSize === profile.paperSize
        ? { ...item, isDefault: false }
        : item,
    )
  next.push(profile)
  return writeProfiles(next, storage)
}

export function deletePrinterProfile(
  profileId: string,
  storage: ProfileStorage | undefined = browserStorage(),
) {
  if (!storage) return false
  const current = readPrinterProfiles(storage)
  const next = current.filter((profile) => profile.id !== profileId)
  return next.length !== current.length && writeProfiles(next, storage)
}

export function setDefaultPrinterProfile(
  profileId: string,
  storage: ProfileStorage | undefined = browserStorage(),
) {
  if (!storage) return false
  const current = readPrinterProfiles(storage)
  const target = current.find((profile) => profile.id === profileId)
  if (!target) return false
  return writeProfiles(
    current.map((profile) => ({
      ...profile,
      isDefault:
        profile.id === profileId ||
        (profile.isDefault && profile.paperSize !== target.paperSize),
    })),
    storage,
  )
}

export function exportPrinterProfiles(
  storage: ProfileStorage | undefined = browserStorage(),
) {
  return serializePrinterProfiles(readPrinterProfiles(storage))
}

export function importPrinterProfiles(
  json: string,
  storage: ProfileStorage | undefined = browserStorage(),
) {
  if (!storage) return false
  let imported: PrinterProfile[]
  try {
    imported = parsePrinterProfileFile(json)
  } catch {
    return false
  }
  const merged = new Map(
    readPrinterProfiles(storage).map((profile) => [profile.id, profile]),
  )
  imported.forEach((profile) => merged.set(profile.id, profile))
  const profiles = [...merged.values()]
  for (const profile of profiles.filter((item) => item.isDefault)) {
    for (const other of profiles) {
      if (other.id !== profile.id && other.paperSize === profile.paperSize) {
        other.isDefault = false
      }
    }
  }
  return writeProfiles(profiles, storage)
}
