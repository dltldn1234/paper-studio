import { CALIBRATION_REFERENCE_LENGTHS } from '../export/calibration'
import type { CalibrationReferenceLength } from '../export/calibration'
import type { PageOrientation, PaperSize } from '../export/print-layout'

export const PRINTER_PROFILE_FORMAT = 'paper-studio-printer-profile'
export const PRINTER_PROFILE_VERSION = 1

export type AxisMeasurement = {
  targetMm: CalibrationReferenceLength
  measuredMm: number
}

export type PrinterProfile = {
  id: string
  name: string
  manufacturer: string
  model: string
  driverInfo: string
  paperSize: PaperSize
  orientation: PageOrientation
  createdAt: string
  updatedAt: string
  measuredAt: string | null
  xMeasurements: AxisMeasurement[]
  yMeasurements: AxisMeasurement[]
  isDefault: boolean
  correction: { xScale: number; yScale: number } | null
  verification: {
    measuredAt: string
    xMeasurements: AxisMeasurement[]
    yMeasurements: AxisMeasurement[]
    status: 'verified' | 'needs-review'
  } | null
}

export type PrinterProfileFile = {
  format: typeof PRINTER_PROFILE_FORMAT
  version: typeof PRINTER_PROFILE_VERSION
  profiles: PrinterProfile[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMeasurements(value: unknown): value is AxisMeasurement[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        CALIBRATION_REFERENCE_LENGTHS.includes(
          item.targetMm as CalibrationReferenceLength,
        ) &&
        typeof item.measuredMm === 'number' &&
        Number.isFinite(item.measuredMm) &&
        item.measuredMm > 0 &&
        item.measuredMm <= Number(item.targetMm) * 2,
    )
  )
}

export function isPrinterProfile(value: unknown): value is PrinterProfile {
  if (!isRecord(value)) return false
  const verification = value.verification
  const correction = value.correction
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.manufacturer === 'string' &&
    typeof value.model === 'string' &&
    typeof value.driverInfo === 'string' &&
    (value.paperSize === 'A4' || value.paperSize === 'A3') &&
    (value.orientation === 'portrait' || value.orientation === 'landscape') &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === 'string' &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    (value.measuredAt === null ||
      (typeof value.measuredAt === 'string' &&
        Number.isFinite(Date.parse(value.measuredAt)))) &&
    isMeasurements(value.xMeasurements) &&
    isMeasurements(value.yMeasurements) &&
    typeof value.isDefault === 'boolean' &&
    (correction === null ||
      (isRecord(correction) &&
        typeof correction.xScale === 'number' &&
        Number.isFinite(correction.xScale) &&
        correction.xScale >= 0.5 &&
        correction.xScale <= 2 &&
        typeof correction.yScale === 'number' &&
        Number.isFinite(correction.yScale) &&
        correction.yScale >= 0.5 &&
        correction.yScale <= 2)) &&
    (verification === null ||
      (isRecord(verification) &&
        typeof verification.measuredAt === 'string' &&
        Number.isFinite(Date.parse(verification.measuredAt)) &&
        isMeasurements(verification.xMeasurements) &&
        isMeasurements(verification.yMeasurements) &&
        (verification.status === 'verified' ||
          verification.status === 'needs-review')))
  )
}

export function createPrinterProfile(
  input: Pick<
    PrinterProfile,
    | 'name'
    | 'manufacturer'
    | 'model'
    | 'driverInfo'
    | 'paperSize'
    | 'orientation'
  > & { id?: string; now?: string },
): PrinterProfile {
  const now = input.now ?? new Date().toISOString()
  const profile: PrinterProfile = {
    id:
      input.id ?? globalThis.crypto?.randomUUID?.() ?? `printer-${Date.now()}`,
    name: input.name.trim(),
    manufacturer: input.manufacturer.trim(),
    model: input.model.trim(),
    driverInfo: input.driverInfo.trim(),
    paperSize: input.paperSize,
    orientation: input.orientation,
    createdAt: now,
    updatedAt: now,
    measuredAt: null,
    xMeasurements: [],
    yMeasurements: [],
    isDefault: false,
    correction: null,
    verification: null,
  }
  if (!isPrinterProfile(profile)) {
    throw new RangeError('Printer profile fields are invalid.')
  }
  return profile
}

export function parsePrinterProfiles(value: unknown): PrinterProfile[] {
  if (
    !isRecord(value) ||
    value.format !== PRINTER_PROFILE_FORMAT ||
    value.version !== PRINTER_PROFILE_VERSION ||
    !Array.isArray(value.profiles) ||
    !value.profiles.every(isPrinterProfile) ||
    new Set(value.profiles.map((profile) => profile.id)).size !==
      value.profiles.length
  ) {
    throw new RangeError('This printer profile file is invalid or unsupported.')
  }
  return value.profiles
}

export function serializePrinterProfiles(profiles: PrinterProfile[]): string {
  if (!profiles.every(isPrinterProfile)) {
    throw new RangeError('Printer profiles contain invalid fields.')
  }
  return JSON.stringify(
    {
      format: PRINTER_PROFILE_FORMAT,
      version: PRINTER_PROFILE_VERSION,
      profiles,
    },
    null,
    2,
  )
}

export function parsePrinterProfileFile(json: string): PrinterProfile[] {
  try {
    return parsePrinterProfiles(JSON.parse(json) as unknown)
  } catch (error) {
    if (error instanceof RangeError) throw error
    throw new RangeError('Printer profile JSON could not be read.', {
      cause: error,
    })
  }
}
