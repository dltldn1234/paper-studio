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
import { createCorrectedPrintableNet } from './precision-export'
import type { PdfCalibrationSelection } from './precision-export'
import type { PrintableNet } from './printable-net'
import type { PrintLayout, PrintSettings, PrintTile } from './print-layout'
import { computePrintLayout } from './print-layout'
import type { FaceMaterial } from '../materials/materials'
import { preparePdfTexture } from './pdf-texture'
import {
  mmToPdfPoints,
  PDF_POINTS_PER_MM,
  worldPointToPdfPage,
} from './pdf-units'
import { runPrintPreflight } from './preflight'

export { PDF_POINTS_PER_MM } from './pdf-units'

type Rect = { x: number; y: number; width: number; height: number }

export type PdfProductionOptions = {
  faceMaterials?: Record<string, FaceMaterial>
  calibration?: PdfCalibrationSelection
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
  imageCache = new Map<
    string,
    Promise<Awaited<ReturnType<PDFDocument['embedPng']>>>
  >(),
) {
  const marginMm = layout.settings.marginMm
  for (const face of net.faces) {
    const material = materials[face.id]
    if (!material?.color || !/^#[\da-f]{6}$/i.test(material.color)) continue
    const faceMinX = Math.min(...face.polygon.map(({ x }) => x))
    const faceMaxX = Math.max(...face.polygon.map(({ x }) => x))
    const faceMinY = Math.min(...face.polygon.map(({ y }) => y))
    const faceMaxY = Math.max(...face.polygon.map(({ y }) => y))
    if (
      faceMaxX < tile.visibleBounds.x ||
      faceMinX > tile.visibleBounds.x + tile.visibleBounds.width ||
      faceMaxY < tile.visibleBounds.y ||
      faceMinY > tile.visibleBounds.y + tile.visibleBounds.height
    ) {
      continue
    }
    const clipped = clipPolygon(face.polygon, tile.visibleBounds)
    if (clipped.length < 3) continue
    const path = clipped
      .map((point, index) => {
        const { x, y } = worldPointToPdfPage(
          point,
          tile.origin,
          marginMm,
          layout.pageHeightMm,
        )
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
    page.drawSvgPath(`${path} Z`, { color: parseColor(material.color) })
    const texture = material.texture
    if (!texture) continue
    let imagePromise = imageCache.get(texture.dataUrl)
    if (!imagePromise) {
      imagePromise = (async () => {
        const prepared = await preparePdfTexture(texture.dataUrl)
        return prepared.mime === 'png'
          ? pdf.embedPng(prepared.bytes)
          : pdf.embedJpg(prepared.bytes)
      })()
      imageCache.set(texture.dataUrl, imagePromise)
    }
    let image
    try {
      image = await imagePromise
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Unknown image error.'
      throw new Error(
        `Could not prepare the texture on face ${face.id} for PDF export: ${detail}`,
        { cause: error },
      )
    }
    const clipPoints = clipped.map((point) => {
      return worldPointToPdfPage(
        point,
        tile.origin,
        marginMm,
        layout.pageHeightMm,
      )
    })
    page.pushOperators(
      pushGraphicsState(),
      moveTo(clipPoints[0].x, clipPoints[0].y),
      ...clipPoints.slice(1).map(({ x, y }) => lineTo(x, y)),
      closePath(),
      clip(),
      endPath(),
    )
    const minX = faceMinX + texture.offsetX
    const minY = faceMinY + texture.offsetY
    const tileWidth = faceMaxX - faceMinX
    const tileHeight = faceMaxY - faceMinY
    const stepX = tileWidth * texture.scale
    const stepY = tileHeight * texture.scale
    const firstVisibleX =
      minX +
      Math.max(0, Math.floor((tile.visibleBounds.x - minX) / stepX)) * stepX
    const firstVisibleY =
      minY +
      Math.max(0, Math.floor((tile.visibleBounds.y - minY) / stepY)) * stepY
    const lastVisibleX = Math.min(
      faceMaxX,
      tile.visibleBounds.x + tile.visibleBounds.width,
    )
    const lastVisibleY = Math.min(
      faceMaxY,
      tile.visibleBounds.y + tile.visibleBounds.height,
    )
    for (let x = firstVisibleX; x < lastVisibleX; x += stepX) {
      for (let y = firstVisibleY; y < lastVisibleY; y += stepY) {
        const imageOrigin = worldPointToPdfPage(
          { x, y: y + stepY },
          tile.origin,
          marginMm,
          layout.pageHeightMm,
        )
        page.drawImage(image, {
          x: imageOrigin.x,
          y: imageOrigin.y,
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
  const pointToPage = (point: Point2D) =>
    worldPointToPdfPage(
      point,
      tile.origin,
      printLayout.settings.marginMm,
      printLayout.pageHeightMm,
    )
  const first = pointToPage(clipped.start)
  const second = pointToPage(clipped.end)
  page.drawLine({
    start: first,
    end: second,
    thickness:
      kind === 'guide' ? 0.35 : mmToPdfPoints(kind === 'cut' ? 0.25 : 0.2),
    color: kind === 'guide' ? rgb(0.45, 0.45, 0.45) : rgb(0.08, 0.08, 0.08),
    ...(kind === 'fold' ? { dashArray: [2, 1].map(mmToPdfPoints) } : {}),
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
  calibration?: PdfCalibrationSelection,
) {
  const pageHeight = layout.pageHeightMm * PDF_POINTS_PER_MM
  const margin = mmToPdfPoints(layout.settings.marginMm)
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
  if (calibration) {
    page.drawText(
      `Calibration profile ${calibration.profileId} · X ${(calibration.xScale * 100).toFixed(2)}% · Y ${(calibration.yScale * 100).toFixed(2)}%`,
      {
        x: margin,
        y: margin / 2 + 8,
        size: 5.5,
        font,
        color: rgb(0.18, 0.34, 0.58),
      },
    )
  }

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
    const centerPoint = worldPointToPdfPage(
      center,
      tile.origin,
      layout.settings.marginMm,
      layout.pageHeightMm,
    )
    const x = centerPoint.x - font.widthOfTextAtSize(text, textSize) / 2
    const y = centerPoint.y - textSize / 2
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
  calibration?: PdfCalibrationSelection,
): PrintLayout {
  const source =
    net.faces.length > 0 && Array.isArray(net.faces[0].polygon)
      ? (net as PrintableNet)
      : createPrintableNet(net as NetLayout | UnfoldedNet)
  const printable = calibration
    ? createCorrectedPrintableNet(source, calibration)
    : source
  return computePrintLayout(printable.bounds, settings)
}

export async function createTiledPdf(
  net: NetLayout | UnfoldedNet | PrintableNet,
  settings: PrintSettings,
  title = 'Paper Studio printable net',
  options: PdfProductionOptions = {},
): Promise<Uint8Array> {
  const sourcePrintable =
    net.faces.length > 0 && Array.isArray(net.faces[0].polygon)
      ? (net as PrintableNet)
      : createPrintableNet(net as NetLayout | UnfoldedNet)
  const printable = options.calibration
    ? createCorrectedPrintableNet(sourcePrintable, options.calibration)
    : sourcePrintable
  const faceMaterials = options.calibration
    ? Object.fromEntries(
        Object.entries(options.faceMaterials ?? {}).map(
          ([faceId, material]) => [
            faceId,
            material.texture
              ? {
                  ...material,
                  texture: {
                    ...material.texture,
                    offsetX:
                      material.texture.offsetX * options.calibration!.xScale,
                    offsetY:
                      material.texture.offsetY * options.calibration!.yScale,
                  },
                }
              : material,
          ],
        ),
      )
    : options.faceMaterials
  const layout = createPrintLayout(printable, settings)
  const preflight = runPrintPreflight(printable, layout, faceMaterials)
  if (preflight.hasErrors) {
    const errors = preflight.issues
      .filter(({ severity }) => severity === 'error')
      .map(({ message }) => message)
    throw new Error(`Print preflight failed: ${errors.join(' ')}`)
  }
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setCreator('Paper Studio')
  if (options.calibration) {
    pdf.setSubject(
      `Printer profile ${options.calibration.profileId}; X ${options.calibration.xScale}; Y ${options.calibration.yScale}`,
    )
  }
  pdf.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None)
  pdf.catalog.getOrCreateViewerPreferences().setPickTrayByPDFSize(true)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const tabbedEdgeIds = new Set(printable.glueTabs.map((tab) => tab.edgeId))
  const pageSize = [
    mmToPdfPoints(layout.pageWidthMm),
    mmToPdfPoints(layout.pageHeightMm),
  ] as [number, number]

  const totalPages = layout.tiles.length + 1
  const imageCache = new Map<
    string,
    Promise<Awaited<ReturnType<PDFDocument['embedPng']>>>
  >()
  for (const tile of layout.tiles) {
    const page = pdf.addPage(pageSize)
    await drawFaceMaterials(
      pdf,
      page,
      tile,
      layout,
      printable,
      faceMaterials,
      imageCache,
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
      options.calibration,
    )
  }

  const calibrationPage = pdf.addPage(pageSize)
  const margin = mmToPdfPoints(settings.marginMm)
  const calibration = createPdfCalibrationGuide(
    layout.pageWidthMm,
    layout.pageHeightMm,
    settings.marginMm,
  )
  if (
    options.calibration &&
    (calibration.square.sizeMm * options.calibration.xScale >
      layout.printableWidthMm - 20 ||
      calibration.square.sizeMm * options.calibration.yScale >
        layout.printableHeightMm - 20 ||
      150 * options.calibration.xScale > layout.printableWidthMm - 20 ||
      150 * options.calibration.yScale > layout.printableHeightMm - 20)
  ) {
    throw new Error(
      'The selected correction makes the calibration marks exceed the printable page area. Use a smaller correction or a larger paper size.',
    )
  }
  const squareX = mmToPdfPoints(calibration.square.x)
  const squareY = mmToPdfPoints(calibration.square.y)
  const sizeX = mmToPdfPoints(
    calibration.square.sizeMm * (options.calibration?.xScale ?? 1),
  )
  const sizeY = mmToPdfPoints(
    calibration.square.sizeMm * (options.calibration?.yScale ?? 1),
  )
  const blue = rgb(0.12, 0.38, 0.72)
  calibrationPage.drawText('PRINT SCALE CALIBRATION', {
    x: margin,
    y: mmToPdfPoints(layout.pageHeightMm) - margin - 8,
    size: 10,
    font,
    color: blue,
  })
  calibrationPage.drawRectangle({
    x: squareX,
    y: squareY,
    width: sizeX,
    height: sizeY,
    borderColor: blue,
    borderWidth: 0.6,
  })
  for (const reference of calibration.lines) {
    calibrationPage.drawLine({
      start: {
        x: mmToPdfPoints(reference.x1),
        y: mmToPdfPoints(reference.y),
      },
      end: {
        x: mmToPdfPoints(
          reference.x1 +
            reference.lengthMm * (options.calibration?.xScale ?? 1),
        ),
        y: mmToPdfPoints(reference.y),
      },
      thickness: 0.8,
      color: blue,
    })
    calibrationPage.drawText(`${reference.lengthMm} mm line`, {
      x: mmToPdfPoints(reference.x1),
      y: mmToPdfPoints(reference.labelY),
      size: 8,
      font,
      color: blue,
    })
  }
  for (const reference of calibration.verticalLines) {
    const x = mmToPdfPoints(reference.x)
    const y1 = mmToPdfPoints(reference.y1)
    const y2 = mmToPdfPoints(
      reference.y1 + reference.lengthMm * (options.calibration?.yScale ?? 1),
    )
    calibrationPage.drawLine({
      start: { x, y: y1 },
      end: { x, y: y2 },
      thickness: 0.8,
      color: blue,
    })
    calibrationPage.drawText(`${reference.lengthMm} mm Y`, {
      x: mmToPdfPoints(reference.labelX),
      y: mmToPdfPoints(reference.labelY),
      size: 8,
      font,
      color: blue,
    })
  }
  calibrationPage.drawText(
    `${options.calibration ? `Profile ${options.calibration.profileId}: X ${(options.calibration.xScale * 100).toFixed(2)}%, Y ${(options.calibration.yScale * 100).toFixed(2)}%. ` : ''}Print at Actual Size / 100%. Turn off Fit or Shrink. Measure the line and square before cutting. X/Y scaling changes face and tab proportions and can affect assembly.`,
    {
      x: margin,
      y: margin,
      size: 7,
      font,
      color: rgb(0.25, 0.25, 0.25),
      maxWidth: mmToPdfPoints(layout.pageWidthMm) - margin * 2,
    },
  )

  return pdf.save()
}
