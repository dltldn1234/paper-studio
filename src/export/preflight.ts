import type { PrintableNet } from './printable-net'
import type { PrintLayout } from './print-layout'
import type { FaceMaterial } from '../materials/materials'
import {
  MAX_PDF_TEXTURE_BYTES,
  MAX_PDF_TEXTURE_DIMENSION,
  MAX_PDF_TEXTURE_PIXELS,
} from './pdf-texture'
import { mmToPdfPoints, pdfPointsToMm } from './pdf-units'

export type PreflightSeverity = 'error' | 'warning' | 'info'
export type PreflightIssue = {
  code: string
  severity: PreflightSeverity
  message: string
  itemId?: string
}
export type PrintPreflightReport = {
  issues: PreflightIssue[]
  pageCount: number
  hasErrors: boolean
}

type RasterDimensions = { width: number; height: number }

function readDimensions(
  bytes: Uint8Array,
  mime: string,
): RasterDimensions | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (
    mime === 'png' &&
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    String.fromCharCode(...bytes.slice(1, 4)) === 'PNG'
  ) {
    return { width: view.getUint32(16), height: view.getUint32(20) }
  }
  if (
    mime === 'webp' &&
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16))
    if (chunk === 'VP8X') {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16)
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
      return { width, height }
    }
    if (chunk === 'VP8L' && bytes[20] === 0x2f && bytes.length >= 25) {
      const width = 1 + ((bytes[22] & 0x3f) << 8) + bytes[21]
      const height =
        1 + ((bytes[24] & 0x0f) << 10) + (bytes[23] << 2) + (bytes[22] >> 6)
      return { width, height }
    }
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d) {
      const width = view.getUint16(26, true) & 0x3fff || 0
      const height = view.getUint16(28, true) & 0x3fff || 0
      return { width, height }
    }
  }
  if (
    mime === 'jpeg' &&
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8
  ) {
    let offset = 2
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) return null
      const marker = bytes[offset + 1]
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3]
      if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length)
        return null
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        return {
          height: (bytes[offset + 5] << 8) | bytes[offset + 6],
          width: (bytes[offset + 7] << 8) | bytes[offset + 8],
        }
      }
      offset += segmentLength + 2
    }
  }
  return null
}

function inspectTexture(
  dataUrl: string,
): { dimensions: RasterDimensions } | { error: string } {
  const match = /^data:image\/(png|jpeg|webp);base64,([\da-z+/]+=*)$/i.exec(
    dataUrl,
  )
  if (!match) return { error: 'Texture is not a supported base64 image.' }
  let binary: string
  try {
    binary = atob(match[2])
  } catch {
    return { error: 'Texture image data is malformed.' }
  }
  if (binary.length > MAX_PDF_TEXTURE_BYTES) {
    return { error: 'Texture exceeds the 4 MB PDF export limit.' }
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const mime = match[1].toLowerCase()
  const dimensions = readDimensions(bytes, mime)
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    return { error: 'Texture dimensions could not be read from the image.' }
  }
  if (
    dimensions.width > MAX_PDF_TEXTURE_DIMENSION ||
    dimensions.height > MAX_PDF_TEXTURE_DIMENSION ||
    dimensions.width * dimensions.height > MAX_PDF_TEXTURE_PIXELS
  ) {
    return { error: 'Texture dimensions exceed the PDF export limit.' }
  }
  return { dimensions }
}

function isFiniteBounds(bounds: PrintLayout['tiles'][number]['visibleBounds']) {
  return (
    [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) &&
    bounds.width > 0 &&
    bounds.height > 0
  )
}

export function runPrintPreflight(
  net: PrintableNet,
  layout: PrintLayout,
  materials: Record<string, FaceMaterial> = {},
  minimumDpi = 150,
): PrintPreflightReport {
  const issues: PreflightIssue[] = []
  const add = (
    code: string,
    severity: PreflightSeverity,
    message: string,
    itemId?: string,
  ) => issues.push({ code, severity, message, ...(itemId ? { itemId } : {}) })

  for (const interference of net.tabInterferences) {
    if (interference.kind === 'tab-face') {
      add(
        'tab-face-overlap',
        'warning',
        'A glue tab overlaps a neighbouring face.',
        interference.tabId,
      )
    } else {
      add(
        'tab-tab-overlap',
        'warning',
        'Two glue tabs overlap each other.',
        interference.firstTabId,
      )
    }
  }

  const expectedTileCount = layout.rows * layout.columns
  const tileKeys = new Set(
    layout.tiles.map(({ row, column }) => `${row}:${column}`),
  )
  const tilesAreValid =
    Number.isInteger(layout.rows) &&
    Number.isInteger(layout.columns) &&
    layout.rows > 0 &&
    layout.columns > 0 &&
    layout.tiles.length === expectedTileCount &&
    layout.tiles.every(
      (tile, index) =>
        tile.pageNumber === index + 1 &&
        tile.row >= 1 &&
        tile.row <= layout.rows &&
        tile.column >= 1 &&
        tile.column <= layout.columns &&
        isFiniteBounds(tile.visibleBounds),
    ) &&
    tileKeys.size === expectedTileCount
  if (!tilesAreValid) {
    add(
      'missing-tile-page',
      'error',
      'The print layout has missing, duplicate, or invalid tile pages.',
    )
  }
  if (layout.tiles.length > 1) {
    add(
      'multi-page-layout',
      'info',
      `The net requires ${layout.tiles.length} tiled print pages.`,
    )
  }
  if (layout.requiresMultiplePages && layout.tiles.length <= 1) {
    add(
      'print-area-exceeded',
      'error',
      'The net exceeds one page but no complete tile layout was produced.',
    )
  }

  const allPoints = [
    ...net.faces.flatMap(({ polygon }) => polygon),
    ...net.glueTabs.flatMap(({ polygon }) => polygon.vertices),
    ...net.edges.flatMap(({ start, end }) => [start, end]),
  ]
  const tileBounds = layout.tiles.map(({ visibleBounds }) => visibleBounds)
  if (
    !allPoints.length ||
    !allPoints.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)) ||
    !tileBounds.length ||
    !tileBounds.every(isFiniteBounds)
  ) {
    add(
      'page-boundary-invalid',
      'error',
      'Geometry or page bounds contain invalid coordinates.',
    )
  } else {
    const extent = {
      minX: Math.min(...tileBounds.map(({ x }) => x)),
      minY: Math.min(...tileBounds.map(({ y }) => y)),
      maxX: Math.max(...tileBounds.map(({ x, width }) => x + width)),
      maxY: Math.max(...tileBounds.map(({ y, height }) => y + height)),
    }
    if (
      allPoints.some(
        ({ x, y }) =>
          x < extent.minX - 1e-6 ||
          x > extent.maxX + 1e-6 ||
          y < extent.minY - 1e-6 ||
          y > extent.maxY + 1e-6,
      )
    ) {
      add(
        'page-boundary-overflow',
        'error',
        'Some faces or glue tabs fall outside all printable tile pages.',
      )
    }
  }

  try {
    const points = mmToPdfPoints(layout.pageWidthMm)
    if (
      points <= 0 ||
      Math.abs(pdfPointsToMm(points) - layout.pageWidthMm) > 1e-8 ||
      !Number.isFinite(mmToPdfPoints(layout.pageHeightMm))
    ) {
      throw new RangeError('Page unit conversion is not reversible.')
    }
  } catch {
    add(
      'invalid-mm-conversion',
      'error',
      'Page dimensions cannot be converted accurately from millimetres to PDF points.',
    )
  }

  for (const [faceId, material] of Object.entries(materials)) {
    const texture = material.texture
    if (!texture) continue
    const inspected = inspectTexture(texture.dataUrl)
    if ('error' in inspected) {
      add('invalid-pdf-texture', 'error', inspected.error, faceId)
      continue
    }
    const polygon = net.faces.find(({ id }) => id === faceId)?.polygon ?? []
    const xs = polygon.map(({ x }) => x)
    const ys = polygon.map(({ y }) => y)
    const widthMm = (Math.max(...xs) - Math.min(...xs)) * texture.scale
    const heightMm = (Math.max(...ys) - Math.min(...ys)) * texture.scale
    const dpiX = (inspected.dimensions.width / widthMm) * 25.4
    const dpiY = (inspected.dimensions.height / heightMm) * 25.4
    if (
      !Number.isFinite(dpiX) ||
      !Number.isFinite(dpiY) ||
      Math.min(dpiX, dpiY) < minimumDpi
    ) {
      add(
        'low-image-resolution',
        'warning',
        `Texture resolution is below ${minimumDpi} DPI at the current face scale.`,
        faceId,
      )
    }
  }

  const hasCutLines =
    layout.settings.showCutLines !== false &&
    (net.edges.some(({ kind }) => kind === 'cut') || net.glueTabs.length > 0)
  const hasFoldLines =
    layout.settings.showFoldLines !== false &&
    net.edges.some(({ kind }) => kind === 'fold')
  if (!hasCutLines) {
    add(
      'cut-lines-not-identifiable',
      'warning',
      'Cut lines are hidden or absent in the current print settings.',
    )
  }
  if (!hasFoldLines) {
    add(
      'fold-lines-not-identifiable',
      'warning',
      'Fold lines are hidden or absent in the current print settings.',
    )
  }
  if (hasCutLines && hasFoldLines) {
    add(
      'line-styles',
      'info',
      'Cut lines use solid strokes and fold lines use dashed strokes.',
    )
  }

  return {
    issues,
    pageCount: layout.tiles.length + 1,
    hasErrors: issues.some(({ severity }) => severity === 'error'),
  }
}
