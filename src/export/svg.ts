import type { NetLayout, Point2D, UnfoldedNet } from '../geometry'
import { createSvgCalibrationGuide } from './calibration'

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
): string {
  const { x, y, width, height } = layout.bounds
  if (
    ![x, y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError('Unfolded net bounds must be finite and positive.')
  }
  const points = [
    ...layout.faces.flatMap((face) => face.polygon),
    ...layout.edges.flatMap((edge) => [edge.start, edge.end]),
  ]
  if (
    points.some(
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
  const edges = layout.edges
    .map(
      (edge) =>
        `  <line class="${edge.kind}" data-kind="${edge.kind}" x1="${number(edge.start.x)}" y1="${number(edge.start.y)}" x2="${number(edge.end.x)}" y2="${number(edge.end.y)}" />`,
    )
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
    .face-label { fill: #333; font-family: sans-serif; font-size: 3px; }
  </style>
${edges}
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
