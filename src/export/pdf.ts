import { PDFDocument, PrintScaling, StandardFonts, rgb } from 'pdf-lib'
import type { NetLayout, Point2D } from '../geometry'
import { validateNetBounds } from './svg'
import { createPdfCalibrationGuide } from './calibration'
import type { PrintLayout, PrintSettings, PrintTile } from './print-layout'
import { computePrintLayout } from './print-layout'

export const PDF_POINTS_PER_MM = 72 / 25.4

type Rect = { x: number; y: number; width: number; height: number }

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
  net: NetLayout,
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

  for (const face of net.faces) {
    const center = {
      x: face.origin.x + face.widthMm / 2,
      y: face.origin.y + face.heightMm / 2,
    }
    if (
      center.x < tile.visibleBounds.x ||
      center.x > tile.visibleBounds.x + tile.visibleBounds.width ||
      center.y < tile.visibleBounds.y ||
      center.y > tile.visibleBounds.y + tile.visibleBounds.height
    ) {
      continue
    }
    const text = `${face.id} ${face.widthMm} x ${face.heightMm} mm`
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
  net: NetLayout,
  settings: PrintSettings,
): PrintLayout {
  validateNetBounds(net)
  return computePrintLayout(net.bounds, settings)
}

export async function createTiledPdf(
  net: NetLayout,
  settings: PrintSettings,
  title = 'Paper Studio printable net',
): Promise<Uint8Array> {
  const layout = createPrintLayout(net, settings)
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setCreator('Paper Studio')
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None)
  pdf.catalog.getOrCreateViewerPreferences().setPickTrayByPDFSize(true)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const tabbedEdgeIds = new Set(net.glueTabs.map((tab) => tab.edgeId))
  const pageSize = [
    layout.pageWidthMm * PDF_POINTS_PER_MM,
    layout.pageHeightMm * PDF_POINTS_PER_MM,
  ] as [number, number]

  const totalPages = layout.tiles.length + 1
  for (const tile of layout.tiles) {
    const page = pdf.addPage(pageSize)
    for (const edge of net.edges) {
      const kind = tabbedEdgeIds.has(edge.id) ? 'fold' : edge.kind
      drawWorldLine(page, tile, layout, edge.start, edge.end, kind)
    }
    for (const tab of net.glueTabs) {
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
    drawPageLabels(page, tile, layout, totalPages, font, net)
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
