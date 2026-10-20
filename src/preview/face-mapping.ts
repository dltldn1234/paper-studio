import type { FaceId } from '../geometry'

const MATERIAL_FACE_IDS: FaceId[] = [
  'right',
  'left',
  'top',
  'bottom',
  'back',
  'front',
]

export function faceIdForMaterialIndex(
  materialIndex: number | undefined,
): FaceId | null {
  return materialIndex === undefined
    ? null
    : (MATERIAL_FACE_IDS[materialIndex] ?? null)
}

export function materialIndexForFaceId(faceId: FaceId): number {
  return MATERIAL_FACE_IDS.indexOf(faceId)
}
