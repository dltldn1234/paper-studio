export const MAX_PDF_TEXTURE_BYTES = 4 * 1024 * 1024
export const MAX_PDF_TEXTURE_DIMENSION = 4096
export const MAX_PDF_TEXTURE_PIXELS = 16_777_216

export type PdfTextureRasterizer = (
  dataUrl: string,
) => Promise<{ pngDataUrl: string; width: number; height: number }>

function decodeBase64DataUrl(dataUrl: string) {
  const match = /^data:image\/(png|jpeg|webp);base64,([\da-z+/]+=*)$/i.exec(
    dataUrl,
  )
  if (!match) throw new RangeError('Texture is not a supported base64 image.')
  let binary: string
  try {
    binary = atob(match[2])
  } catch {
    throw new RangeError('Texture image data is invalid.')
  }
  if (binary.length > MAX_PDF_TEXTURE_BYTES) {
    throw new RangeError('Texture exceeds the 4 MB PDF export limit.')
  }
  return {
    mime: match[1].toLowerCase(),
    bytes: Uint8Array.from(binary, (c) => c.charCodeAt(0)),
  }
}

async function rasterizeWebpToPng(dataUrl: string) {
  if (
    typeof createImageBitmap !== 'function' ||
    typeof document === 'undefined'
  ) {
    throw new Error('This browser cannot convert WebP textures for PDF export.')
  }
  const { bytes } = decodeBase64DataUrl(dataUrl)
  const bitmap = await createImageBitmap(
    new Blob([bytes], { type: 'image/webp' }),
  )
  try {
    if (
      bitmap.width <= 0 ||
      bitmap.height <= 0 ||
      bitmap.width > MAX_PDF_TEXTURE_DIMENSION ||
      bitmap.height > MAX_PDF_TEXTURE_DIMENSION ||
      bitmap.width * bitmap.height > MAX_PDF_TEXTURE_PIXELS
    ) {
      throw new RangeError(
        'WebP texture dimensions exceed the PDF export limit (4096 px per side, 16 megapixels total).',
      )
    }
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error('Could not create the browser image conversion surface.')
    context.drawImage(bitmap, 0, 0)
    const pngDataUrl = canvas.toDataURL('image/png')
    if (!pngDataUrl.startsWith('data:image/png;base64,')) {
      throw new Error('The browser could not convert the WebP texture to PNG.')
    }
    const converted = decodeBase64DataUrl(pngDataUrl)
    return {
      pngDataUrl,
      bytes: converted.bytes,
      width: bitmap.width,
      height: bitmap.height,
    }
  } finally {
    bitmap.close()
  }
}

/** Returns PDF-ready bytes; WebP is converted only in memory and alpha is retained as PNG. */
export async function preparePdfTexture(
  dataUrl: string,
  rasterize: PdfTextureRasterizer = rasterizeWebpToPng,
) {
  const source = decodeBase64DataUrl(dataUrl)
  if (source.mime !== 'webp') return { mime: source.mime, bytes: source.bytes }
  const result = await rasterize(dataUrl)
  if (
    !Number.isInteger(result.width) ||
    !Number.isInteger(result.height) ||
    result.width <= 0 ||
    result.height <= 0 ||
    result.width > MAX_PDF_TEXTURE_DIMENSION ||
    result.height > MAX_PDF_TEXTURE_DIMENSION ||
    result.width * result.height > MAX_PDF_TEXTURE_PIXELS
  ) {
    throw new RangeError('WebP texture dimensions exceed the PDF export limit.')
  }
  const converted = decodeBase64DataUrl(result.pngDataUrl)
  if (converted.mime !== 'png') {
    throw new Error(
      'WebP conversion did not produce a PDF-compatible PNG image.',
    )
  }
  return { mime: 'png', bytes: converted.bytes }
}
