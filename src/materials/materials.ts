export type FaceMaterial = {
  color: string
  texture?: FaceTexture
}

export type FaceTexture = {
  dataUrl: string
  offsetX: number
  offsetY: number
  scale: number
  rotationDeg: number
}

export type MaterialPresetId = 'paper' | 'kraft' | 'blueprint' | 'custom'

export const MATERIAL_PRESETS: Record<
  Exclude<MaterialPresetId, 'custom'>,
  FaceMaterial
> = {
  paper: { color: '#f2eee4' },
  kraft: { color: '#c49a6c' },
  blueprint: { color: '#3b6fa5' },
}

export const DEFAULT_FACE_MATERIAL: FaceMaterial = { color: '#566174' }
export const MAX_TEXTURE_DATA_URL_LENGTH = 5_500_000

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
}

export function validateFaceMaterial(
  value: unknown,
): asserts value is FaceMaterial {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RangeError('Face material must be an object.')
  }
  const material = value as Record<string, unknown>
  if (!isHexColor(material.color)) {
    throw new RangeError('Face material color must be a six digit hex value.')
  }
  if (material.texture === undefined) return
  if (
    !material.texture ||
    typeof material.texture !== 'object' ||
    Array.isArray(material.texture)
  ) {
    throw new RangeError('Face texture settings are invalid.')
  }
  const texture = material.texture as Record<string, unknown>
  if (
    typeof texture.dataUrl !== 'string' ||
    !/^data:image\/(png|jpeg|webp);base64,/i.test(texture.dataUrl) ||
    texture.dataUrl.length > MAX_TEXTURE_DATA_URL_LENGTH ||
    ![
      texture.offsetX,
      texture.offsetY,
      texture.scale,
      texture.rotationDeg,
    ].every((value) => typeof value === 'number' && Number.isFinite(value)) ||
    (texture.scale as number) <= 0 ||
    (texture.scale as number) > 20
  ) {
    throw new RangeError('Face texture settings are invalid.')
  }
}

export function createMaterialMap(
  faceIds: string[],
  material: FaceMaterial = DEFAULT_FACE_MATERIAL,
): Record<string, FaceMaterial> {
  validateFaceMaterial(material)
  return Object.fromEntries(
    faceIds.map((faceId) => [faceId, structuredClone(material)]),
  )
}

export function setFaceMaterial(
  materials: Record<string, FaceMaterial>,
  faceId: string,
  material: FaceMaterial,
): Record<string, FaceMaterial> {
  if (!faceId) throw new RangeError('Face ID must not be empty.')
  validateFaceMaterial(material)
  return { ...materials, [faceId]: structuredClone(material) }
}
