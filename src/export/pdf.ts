import {
  PDFDocument,
  PrintScaling,
  StandardFonts,
  degrees,
  rgb,
  closePath,
  clip,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
} from 'pdf-lib'
import type { NetLayout, Point2D, UnfoldedNet } from '../geometry'
import { createPdfCalibrationGuide } from './calibration'
import { createPrintableNet } from './printable-net'
import type { PrintableNet } from './printable-net'
import type { PrintLayout, PrintSettings, PrintTile } from './print-layout'
import { computePrintLayout } from './print-layout'
import type { FaceMaterial } from '../materials/materials'

export const PDF_POINTS_PER_MM = 72 / 25.4

type Rect = { x: number; y: number; width: number; height: number }

export type PdfProductionOptions = {
  faceMaterials?: Record<string, FaceMaterial>
  showCutLines?: boolean
  showFoldLines?: boolean
  showAssemblyNumbers?: boolean
}

function clipPolygon(points: Point2D[], rect: Rect): Point2D[] {
  const boundaries = [
    {
      inside: (point: Point2D) => point.x >= rect.x,
      intersect: (a: Point2D, b: Point2D) => ({
        x: rect.x,
        y: a.y + ((b.y - a.y) * (rect.x - a.x)) / (b.x - a.x),
      }),
    },
    {
      inside: (point: Point2D) => point.x <= rect.x + rect.width,
      intersect: (a: Point2D, b: Point2D) => ({
        x: rect.x + rect.width,
        y: a.y + ((b.y - a.y) * (rect.x + rect.width - a.x)) / (b.x - a.x),
      }),
    },
    {
      inside: (point: Point2D) => point.y >= rect.y,
      intersect: (a: Point2D, b: Point2D) => ({
        x: a.x + ((b.x - a.x) * (rect.y - a.y)) / (b.y - a.y),
        y: rect.y,
      }),
    },
    {
      inside: (point: Point2D) => point.y <= rect.y + rect.height,
      intersect: (a: Point2D, b: Point2D) => ({
        x: a.x + ((b.x - a.x) * (rect.y + rect.height - a.y)) / (b.y - a.y),
        y: rect.y + rect.height,
      }),
    },
  ]
  let result = points
  for (const boundary of boundaries) {
    const input = result
    result = []
    if (!input.length) break
    let previous = input[input.length - 1]
    for (const current of input) {
      const previousInside = boundary.inside(previous)
      const currentInside = boundary.inside(current)
      if (currentInside) {
        if (!previousInside) result.push(boundary.intersect(previous, current))
        result.push(current)
      } else if (previousInside) {
        result.push(boundary.intersect(previous, current))
      }
      previous = current
    }
  }
  return result
}

function parseColor(hex: string) {
  return rgb(
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  )
}

async function drawFaceMaterials(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument['addPage']>,
  tile: PrintTile,
  layout: PrintLayout,
  net: PrintableNet,
  materials: Record<string, FaceMaterial> = {},
) {
  const margin = layout.settings.marginMm * PDF_POINTS_PER_MM
  const pageHeight = layout.pageHeightMm * PDF_POINTS_PER_MM
  for (const face of net.faces) {
    const material = materials[face.id]
    if (!material?.color || !/^#[\da-f]{6}$/i.test(material.color)) continue
    const clipped = clipPolygon(face.polygon, tile.visibleBounds)
    if (clipped.length < 3) continue
    const path = clipped
      .map((point, index) => {
        const x = margin + (point.x - tile.origin.x) * PDF_POINTS_PER_MM
        const y =
          pageHeight - margin - (point.y - tile.origin.y) * PDF_POINTS_PER_MM
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
    page.drawSvgPath(`${path} Z`, { color: parseColor(material.color) })
    const texture = material.texture
    if (!texture || !/^data:image\/(png|jpeg);base64,/i.test(texture.dataUrl)) {
      continue
    }
    const encoded = texture.dataUrl.slice(texture.dataUrl.indexOf(',') + 1)
    const binary = atob(encoded)
    const imageBytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    )
    const image = texture.dataUrl.toLowerCase().startsWith('data:image/png')
      ? await pdf.embedPng(imageBytes)
      : await pdf.embedJpg(imageBytes)
    const clipPoints = clipped.map((point) => {
      const x = margin + (point.x - tile.origin.x) * PDF_POINTS_PER_MM
      const y =
        pageHeight - margin - (point.y - tile.origin.y) * PDF_POINTS_PER_MM
      return { x, y }
    })
    page.pushOperators(
      pushGraphicsState(),
      moveTo(clipPoints[0].x, clipPoints[0].y),
      ...clipPoints.slice(1).map(({ x, y }) => lineTo(x, y)),
      closePath(),
      clip(),
      endPath(),
    )
    const xs = face.polygon.map(({ x }) => x)
    const ys = face.polygon.map(({ y }) => y)
    const minX = Math.min(...xs) + texture.offsetX
    const minY = Math.min(...ys) + texture.offsetY
    const tileWidth = Math.max(...xs) - Math.min(...xs)
    const tileHeight = Math.max(...ys) - Math.min(...ys)
    const stepX = tileWidth * texture.scale
    const stepY = tileHeight * texture.scale
    for (let x = minX; x < Math.max(...xs); x += stepX) {
      for (let y = minY; y < Math.max(...ys); y += stepY) {
        page.drawImage(image, {
          x: margin + (x - tile.origin.x) * PDF_POINTS_PER_MM,
          y:
            pageHeight -
            margin -
            (y + stepY - tile.origin.y) * PDF_POINTS_PER_MM,
          width: stepX * PDF_POINTS_PER_MM,
          height: stepY * PDF_POINTS_PER_MM,
          rotate: degrees(texture.rotationDeg),
        })
      }
    }
    page.pushOperators(popGraphicsState())
  }
}

function clipLine(start: Point2D, end: Point2D, rect: Rect) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  let lower = 0
  let upper = 1
  const p = [-dx, dx, -dy, dy]
  const q = [
    start.x - rect.x,
    rect.x + rect.width - start.x,
    start.y - rect.y,
    rect.y + rect.height - start.y,
  ]

  for (let index = 0; index < p.length; index += 1) {
    if (Math.abs(p[index]) < 1e-10) {
      if (q[index] < 0) return null
      continue
    }
    const ratio = q[index] / p[index]
    if (p[index] < 0) lower = Math.max(lower, ratio)
    else upper = Math.min(upper, ratio)
    if (lower > upper) return null
  }

  return {
    start: { x: start.x + lower * dx, y: start.y + lower * dy },
    end: { x: start.x + upper * dx, y: start.y + upper * dy },
  }
}

function drawWorldLine(
  page: ReturnType<PDFDocument['addPage']>,
  tile: PrintTile,
  printLayout: PrintLayout,
  start: Point2D,
  end: Point2D,
  kind: 'cut' | 'fold' | 'guide',
) {
  const clipped = clipLine(start, end, tile.visibleBounds)
  if (!clipped) return
  const margin = printLayout.settings.marginMm * PDF_POINTS_PER_MM
  const pointToPage = ({ x, y }: Point2D) => ({
    x: margin + (x - tile.origin.x) * PDF_POINTS_PER_MM,
    y:
      printLayout.pageHeightMm * PDF_POINTS_PER_MM -
      margin -
      (y - tile.origin.y) * PDF_POINTS_PER_MM,
  })
  const first = pointToPage(clipped.start)
  const second = pointToPage(clipped.end)
  page.drawLine({
    start: first,
    end: second,
    thickness:
      kind === 'guide'
        ? 0.35
        : (kind === 'cut' ? 0.25 : 0.2) * PDF_POINTS_PER_MM,
    color: kind === 'guide' ? rgb(0.45, 0.45, 0.45) : rgb(0.08, 0.08, 0.08),
    ...(kind === 'fold'
      ? { dashArray: [2, 1].map((value) => value * PDF_POINTS_PER_MM) }
      : {}),
  })
}

function drawRegistrationGuides(
  page: ReturnType<PDFDocument['addPage']>,
  tile: PrintTile,
  layout: PrintLayout,
) {
  const halfMark = 1.5
  for (const guide of tile.guides) {
    const { x, y } = guide.point
    drawWorldLine(
      page,
      tile,
      layout,
      { x: x - halfMark, y },
      { x: x + halfMark, y },
      'guide',
    )
    drawWorldLine(
      page,
      tile,
      layout,
      { x, y: y - halfMark },
      { x, y: y + halfMark },
      'guide',
    )
  }
}

function drawPageLabels(
  page: ReturnType<PDFDocument['addPage']>,
  tile: PrintTile,
  layout: PrintLayout,
  totalPages: number,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  net: PrintableNet,
  showAssemblyNumbers = true,
) {
  const pageHeight = layout.pageHeightMm * PDF_POINTS_PER_MM
  const margin = layout.settings.marginMm * PDF_POINTS_PER_MM
  const header = `Sheet ${tile.pageNumber}/${totalPages}  |  Row ${tile.row}, Col ${tile.column}  |  Join ${tile.guides.map(({ label }) => label).join(', ') || '-'}`
  page.drawText(header, {
    x: margin,
    y: pageHeight - margin / 2,
    size: 6,
    font,
    color: rgb(0.25, 0.25, 0.25),
  })
  page.drawText('PRINT AT 100% / ACTUAL SIZE. DO NOT FIT OR SHRINK.', {
    x: margin,
    y: margin / 2,
    size: 6,
    font,
    color: rgb(0.25, 0.25, 0.25),
  })

  if (!showAssemblyNumbers) return
  for (const [index, face] of net.faces.entries()) {
    const center = {
      x:
        face.polygon.reduce((sum, point) => sum + point.x, 0) /
        face.polygon.length,
      y:
        face.polygon.reduce((sum, point) => sum + point.y, 0) /
        face.polygon.length,
    }
    if (
      center.x < tile.visibleBounds.x ||
      center.x > tile.visibleBounds.x + tile.visibleBounds.width ||
      center.y < tile.visibleBounds.y ||
      center.y > tile.visibleBounds.y + tile.visibleBounds.height
    ) {
      continue
    }
    const text = `Face ${index + 1} · ${face.id}`
    const textSize = 5.5
    const x =
      margin +
      (center.x - tile.origin.x) * PDF_POINTS_PER_MM -
      font.widthOfTextAtSize(text, textSize) / 2
    const y =
      pageHeight -
      margin -
      (center.y - tile.origin.y) * PDF_POINTS_PER_MM -
      textSize / 2
    page.drawText(text, {
      x,
      y,
      size: textSize,
      font,
      color: rgb(0.35, 0.35, 0.35),
    })
  }
}

export function createPrintLayout(
  net: NetLayout | UnfoldedNet | PrintableNet,
  settings: PrintSettings,
): PrintLayout {
  const printable =
    net.faces.length > 0 && Array.isArray(net.faces[0].polygon)
      ? (net as PrintableNet)
      : createPrintableNet(net as NetLayout | UnfoldedNet)
  return computePrintLayout(printable.bounds, settings)
}

export async function createTiledPdf(
  net: NetLayout | UnfoldedNet | PrintableNet,
  settings: PrintSettings,
  title = 'Paper Studio printable net',
  options: PdfProductionOptions = {},
): Promise<Uint8Array> {
  const printable =
    net.faces.length > 0 && Array.isArray(net.faces[0].polygon)
      ? (net as PrintableNet)
      : createPrintableNet(net as NetLayout | UnfoldedNet)
  const layout = createPrintLayout(printable, settings)
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setCreator('Paper Studio')
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None)
  pdf.catalog.getOrCreateViewerPreferences().setPickTrayByPDFSize(true)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const tabbedEdgeIds = new Set(printable.glueTabs.map((tab) => tab.edgeId))
  const pageSize = [
    layout.pageWidthMm * PDF_POINTS_PER_MM,
    layout.pageHeightMm * PDF_POINTS_PER_MM,
  ] as [number, number]

  const totalPages = layout.tiles.length + 1
  for (const tile of layout.tiles) {
    const page = pdf.addPage(pageSize)
    await drawFaceMaterials(
      pdf,
      page,
      tile,
      layout,
      printable,
      options.faceMaterials,
    )
    for (const edge of printable.edges) {
      const kind = tabbedEdgeIds.has(edge.id) ? 'fold' : edge.kind
      if (
        (kind === 'cut' &&
          (options.showCutLines ?? settings.showCutLines) === false) ||
        (kind === 'fold' &&
          (options.showFoldLines ?? settings.showFoldLines) === false)
      ) {
        continue
      }
      drawWorldLine(page, tile, layout, edge.start, edge.end, kind)
    }
    for (const tab of (options.showCutLines ?? settings.showCutLines) === false
      ? []
      : printable.glueTabs) {
      const vertices = tab.polygon.vertices
      const outline = [...vertices.slice(1), vertices[0]]
      for (let index = 0; index < outline.length - 1; index += 1) {
        drawWorldLine(
          page,
          tile,
          layout,
          outline[index],
          outline[index + 1],
          'cut',
        )
      }
    }
    drawRegistrationGuides(page, tile, layout)
    drawPageLabels(
      page,
      tile,
      layout,
      totalPages,
      font,
      printable,
      options.showAssemblyNumbers ?? settings.showAssemblyNumbers,
    )
  }

  const calibrationPage = pdf.addPage(pageSize)
  const margin = settings.marginMm * PDF_POINTS_PER_MM
  const calibration = createPdfCalibrationGuide(
    layout.pageWidthMm,
    layout.pageHeightMm,
    settings.marginMm,
  )
  const squareX = calibration.square.x * PDF_POINTS_PER_MM
  const squareY = calibration.square.y * PDF_POINTS_PER_MM
  const size = calibration.square.sizeMm * PDF_POINTS_PER_MM
  const blue = rgb(0.12, 0.38, 0.72)
  calibrationPage.drawText('PRINT SCALE CALIBRATION', {
    x: margin,
    y: layout.pageHeightMm * PDF_POINTS_PER_MM - margin - 8,
    size: 10,
    font,
    color: blue,
  })
  calibrationPage.drawRectangle({
    x: squareX,
    y: squareY,
    width: size,
    height: size,
    borderColor: blue,
    borderWidth: 0.6,
  })
  calibrationPage.drawLine({
    start: {
      x: calibration.line.x1 * PDF_POINTS_PER_MM,
      y: calibration.line.y * PDF_POINTS_PER_MM,
    },
    end: {
      x: calibration.line.x2 * PDF_POINTS_PER_MM,
      y: calibration.line.y * PDF_POINTS_PER_MM,
    },
    thickness: 0.8,
    color: blue,
  })
  calibrationPage.drawText('100 mm line', {
    x: calibration.label.x * PDF_POINTS_PER_MM,
    y: calibration.label.y * PDF_POINTS_PER_MM,
    size: 8,
    font,
    color: blue,
  })
  calibrationPage.drawText(
    'Print at Actual Size / 100%. Turn off Fit or Shrink. Measure the line and square before cutting.',
    {
      x: margin,
      y: margin,
      size: 7,
      font,
      color: rgb(0.25, 0.25, 0.25),
      maxWidth: layout.pageWidthMm * PDF_POINTS_PER_MM - margin * 2,
    },
  )

  return pdf.save()
}
