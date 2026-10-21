import { scalePrintableNet } from './printable-net'
import type { PrintableNet } from './printable-net'
import type { FaceMaterial } from '../materials/materials'

export type PdfCalibrationSelection = {
  profileId: string
  profileName?: string
  xScale: number
  yScale: number
  alreadyAppliedProfileIds?: string[]
}

export function validatePdfCalibrationSelection(
  selection: PdfCalibrationSelection,
) {
  if (
    !selection.profileId ||
    (selection.alreadyAppliedProfileIds ?? []).includes(selection.profileId)
  ) {
    throw new RangeError(
      'This printer profile correction has already been applied to the source output.',
    )
  }
  if (
    !Number.isFinite(selection.xScale) ||
    !Number.isFinite(selection.yScale) ||
    selection.xScale < 0.5 ||
    selection.xScale > 2 ||
    selection.yScale < 0.5 ||
    selection.yScale > 2
  ) {
    throw new RangeError('Printer profile scales must be between 0.5 and 2.')
  }
}

export function createCorrectedPrintableNet(
  net: PrintableNet,
  selection: PdfCalibrationSelection,
) {
  validatePdfCalibrationSelection(selection)
  return scalePrintableNet(net, selection.xScale, selection.yScale)
}

export function scaleFaceMaterialOffsets(
  materials: Record<string, FaceMaterial>,
  selection: PdfCalibrationSelection,
) {
  validatePdfCalibrationSelection(selection)
  return Object.fromEntries(
    Object.entries(materials).map(([faceId, material]) => [
      faceId,
      material.texture
        ? {
            ...material,
            texture: {
              ...material.texture,
              offsetX: material.texture.offsetX * selection.xScale,
              offsetY: material.texture.offsetY * selection.yScale,
            },
          }
        : material,
    ]),
  )
}
