import type { GlueTab, NetLayout, Point2D, UnfoldedNet } from '../geometry'
import { createSvgCalibrationGuide } from './calibration'
import type { FaceMaterial } from '../materials/materials'

function number(value: number): string {
  return Number(value.toFixed(5)).toString()
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function path(points: Point2D[]): string {
  return points
    .map(
      ({ x, y }, index) =>
        `${index === 0 ? 'M' : 'L'} ${number(x)} ${number(y)}`,
    )
    .join(' ')
}

export function validateNetBounds(layout: NetLayout): void {
  const { x, y, width, height } = layout.bounds
  if (
    ![x, y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError(
      'Net bounds must have finite coordinates and positive dimensions.',
    )
  }

  const points = [
    ...layout.faces.flatMap((face) => face.polygon.vertices),
    ...layout.edges.flatMap((edge) => [edge.start, edge.end]),
    ...layout.glueTabs.flatMap((tab) => tab.polygon.vertices),
  ]
  const maxX = x + width
  const maxY = y + height
  if (
    points.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < x - 1e-5 ||
        point.y < y - 1e-5 ||
        point.x > maxX + 1e-5 ||
        point.y > maxY + 1e-5,
    )
  ) {
    throw new RangeError(
      'Net bounds do not contain every face, edge, and glue tab.',
    )
  }
}

export function serializeNetToSvg(
  layout: NetLayout,
  title = 'Paper Studio net',
  faceMaterials: Record<string, FaceMaterial> = {},
): string {
  validateNetBounds(layout)
  const calibration = createSvgCalibrationGuide(layout.bounds)
  const { x, y, width, height } = calibration.bounds
  const tabbedEdgeIds = new Set(layout.glueTabs.map((tab) => tab.edgeId))
  const edgeMarkup = layout.edges
    .map((edge) => {
      const kind = tabbedEdgeIds.has(edge.id) ? 'fold' : edge.kind
      return `  <line class="${kind}" data-kind="${kind}" x1="${number(edge.start.x)}" y1="${number(edge.start.y)}" x2="${number(edge.end.x)}" y2="${number(edge.end.y)}" />`
    })
    .join('\n')
  const faceMarkup = layout.faces
    .map((face) => {
      const material = faceMaterials[face.id]
      const textureId = `texture-${escapeXml(face.id)}`
      return `  <polygon class="face-material" data-face-id="${escapeXml(face.id)}" fill="${material?.texture ? `url(#${textureId})` : (material?.color ?? 'none')}" points="${face.polygon.vertices.map(({ x, y }) => `${number(x)},${number(y)}`).join(' ')}" />`
    })
    .join('\n')
  const textureMarkup = layout.faces
    .flatMap((face) => {
      const texture = faceMaterials[face.id]?.texture
      if (!texture) return []
      return [
        `  <pattern id="texture-${escapeXml(face.id)}" patternUnits="userSpaceOnUse" width="${number(face.widthMm * texture.scale)}" height="${number(face.heightMm * texture.scale)}" patternTransform="translate(${number(texture.offsetX)} ${number(texture.offsetY)}) rotate(${number(texture.rotationDeg)})"><image href="${escapeXml(texture.dataUrl)}" width="${number(face.widthMm)}" height="${number(face.heightMm)}" preserveAspectRatio="none" /></pattern>`,
      ]
    })
    .join('\n')
  const tabMarkup = layout.glueTabs
    .map((tab) => {
      const vertices = tab.polygon.vertices
      const cutOutline = path([...vertices.slice(1), vertices[0]])
      return `  <path class="cut glue-tab" data-tab-id="${escapeXml(tab.id)}" data-host-face="${tab.faceId}" d="${cutOutline}" />`
    })
    .join('\n')
  const labelMarkup = layout.faces
    .map((face) => {
      const centerX = face.origin.x + face.widthMm / 2
      const centerY = face.origin.y + face.heightMm / 2
      return `  <text class="face-label" x="${number(centerX)}" y="${number(centerY)}" text-anchor="middle"><tspan>${escapeXml(face.label)}</tspan><tspan x="${number(centerX)}" dy="4">${number(face.widthMm)} × ${number(face.heightMm)} mm</tspan></text>`
    })
    .join('\n')
  const calibrationMarkup = `  <g class="calibration" aria-label="100 millimeter print calibration">
    <rect x="${number(calibration.x)}" y="${number(calibration.y)}" width="${calibration.sizeMm}" height="${calibration.sizeMm}" />
    <line x1="${number(calibration.x)}" y1="${number(calibration.lineY)}" x2="${number(calibration.x + calibration.sizeMm)}" y2="${number(calibration.lineY)}" />
    <text x="${number(calibration.x)}" y="${number(calibration.lineY + 7)}">100 mm · PRINT AT 100%</text>
  </g>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${number(width)}mm" height="${number(height)}mm" viewBox="${number(x)} ${number(y)} ${number(width)} ${number(height)}" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(title)}</title>
  <desc id="description">1:1 millimeter cut and fold pattern with a 100 mm line and square scale check. Print at 100% actual size.</desc>
  <style>
    .cut { fill: none; stroke: #111; stroke-width: 0.25; }
    .fold { fill: none; stroke: #555; stroke-width: 0.2; stroke-dasharray: 2 1; }
    .face-label { fill: #333; font-family: sans-serif; font-size: 3px; }
    .calibration { fill: none; stroke: #2875c7; stroke-width: 0.35; }
    .calibration text { fill: #2875c7; stroke: none; font-family: sans-serif; font-size: 3px; }
  </style>
${textureMarkup}
${faceMarkup}
${edgeMarkup}
${tabMarkup}
${labelMarkup}
${calibrationMarkup}
</svg>
`
}

/** Serializes a generic unfolded polyhedron net at a 1:1 millimetre scale. */
export function serializeUnfoldedNetToSvg(
  layout: UnfoldedNet,
  title = 'Paper Studio polyhedron net',
  glueTabs: GlueTab[] = [],
  faceMaterials: Record<string, FaceMaterial> = {},
): string {
  const sourcePoints = [
    ...layout.faces.flatMap((face) => face.polygon),
    ...layout.edges.flatMap((edge) => [edge.start, edge.end]),
  ]
  const {
    x: sourceX,
    y: sourceY,
    width: sourceWidth,
    height: sourceHeight,
  } = layout.bounds
  const sourceMaxX = sourceX + sourceWidth
  const sourceMaxY = sourceY + sourceHeight
  if (
    ![sourceX, sourceY, sourceWidth, sourceHeight].every(Number.isFinite) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    sourcePoints.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < sourceX - 1e-5 ||
        point.y < sourceY - 1e-5 ||
        point.x > sourceMaxX + 1e-5 ||
        point.y > sourceMaxY + 1e-5,
    )
  ) {
    throw new RangeError('Unfolded net bounds do not contain all geometry.')
  }
  const allPoints = [
    ...sourcePoints,
    ...glueTabs.flatMap((tab) => tab.polygon.vertices),
  ]
  const xs = allPoints.map(({ x }) => x)
  const ys = allPoints.map(({ y }) => y)
  const x = Math.min(layout.bounds.x, ...xs)
  const y = Math.min(layout.bounds.y, ...ys)
  const maxX = Math.max(layout.bounds.x + layout.bounds.width, ...xs)
  const maxY = Math.max(layout.bounds.y + layout.bounds.height, ...ys)
  const width = maxX - x
  const height = maxY - y
  if (
    ![x, y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError('Unfolded net bounds must be finite and positive.')
  }
  if (
    allPoints.some(
      (point) =>
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < x - 1e-5 ||
        point.y < y - 1e-5 ||
        point.x > x + width + 1e-5 ||
        point.y > y + height + 1e-5,
    )
  ) {
    throw new RangeError('Unfolded net bounds do not contain all geometry.')
  }
  const tabbedEdgeIds = new Set(glueTabs.map((tab) => tab.edgeId))
  const edges = layout.edges
    .map((edge) => {
      const kind = tabbedEdgeIds.has(edge.id) ? 'fold' : edge.kind
      return `  <line class="${kind}" data-kind="${kind}" x1="${number(edge.start.x)}" y1="${number(edge.start.y)}" x2="${number(edge.end.x)}" y2="${number(edge.end.y)}" />`
    })
    .join('\n')
  const tabs = glueTabs
    .map((tab) => {
      const vertices = tab.polygon.vertices
      return `  <path class="cut glue-tab" data-tab-id="${escapeXml(tab.id)}" d="${path([...vertices.slice(1), vertices[0]])}" />`
    })
    .join('\n')
  const textures = layout.faces
    .flatMap((face) => {
      const texture = faceMaterials[face.id]?.texture
      if (!texture) return []
      const xs = face.polygon.map(({ x }) => x)
      const ys = face.polygon.map(({ y }) => y)
      const faceWidth = Math.max(...xs) - Math.min(...xs)
      const faceHeight = Math.max(...ys) - Math.min(...ys)
      return [
        `  <pattern id="texture-${escapeXml(face.id)}" patternUnits="userSpaceOnUse" width="${number(faceWidth * texture.scale)}" height="${number(faceHeight * texture.scale)}" patternTransform="translate(${number(texture.offsetX)} ${number(texture.offsetY)}) rotate(${number(texture.rotationDeg)})"><image href="${escapeXml(texture.dataUrl)}" width="${number(faceWidth)}" height="${number(faceHeight)}" preserveAspectRatio="none" /></pattern>`,
      ]
    })
    .join('\n')
  const faceMaterialsMarkup = layout.faces
    .map((face) => {
      const material = faceMaterials[face.id]
      const points = face.polygon
        .map(({ x, y }) => `${number(x)},${number(y)}`)
        .join(' ')
      const fill = material?.texture
        ? `url(#texture-${escapeXml(face.id)})`
        : (material?.color ?? 'none')
      return `  <polygon class="face-material" data-face-id="${escapeXml(face.id)}" fill="${fill}" points="${points}" />`
    })
    .join('\n')
  const labels = layout.faces
    .map((face) => {
      const center = face.polygon.reduce(
        (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 },
      )
      return `  <text class="face-label" x="${number(center.x / face.polygon.length)}" y="${number(center.y / face.polygon.length)}" text-anchor="middle">${escapeXml(face.label)}</text>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${number(width)}mm" height="${number(height)}mm" viewBox="${number(x)} ${number(y)} ${number(width)} ${number(height)}" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(title)}</title>
  <desc id="description">Polyhedron net in millimetres at actual size. Print at 100%.</desc>
  <style>
    .cut { fill: none; stroke: #111; stroke-width: 0.25; }
    .fold { fill: none; stroke: #555; stroke-width: 0.2; stroke-dasharray: 2 1; }
    .face-material { stroke: none; }
    .face-label { fill: #333; font-family: sans-serif; font-size: 3px; }
  </style>
${textures}
${faceMaterialsMarkup}
${edges}
${tabs}
${labels}
</svg>
`
}

export function normalizeSvgFilename(value: string): string {
  const safeBase = value
    .trim()
    .replace(/\.svg$/i, '')
    .replace(/[<>:"/\\|?*]/g, '-')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('')
    .replace(/^\.+/, '')
    .trim()
  return `${safeBase || 'paper-studio-net'}.svg`
}
