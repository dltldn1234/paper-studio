import type { NetBounds, Point2D } from '../geometry'

export type PaperSize = 'A4' | 'A3'
export type PageOrientation = 'portrait' | 'landscape'

export type PrintSettings = {
  paperSize: PaperSize
  orientation: PageOrientation
  marginMm: number
  overlapMm: number
}

export type RegistrationGuide = {
  id: string
  label: string
  point: Point2D
}

export type PrintTile = {
  pageNumber: number
  row: number
  column: number
  origin: Point2D
  visibleBounds: NetBounds
  guides: RegistrationGuide[]
}

export type PrintLayout = {
  settings: PrintSettings
  pageWidthMm: number
  pageHeightMm: number
  printableWidthMm: number
  printableHeightMm: number
  columns: number
  rows: number
  requiresMultiplePages: boolean
  tiles: PrintTile[]
}

const PAPER_SIZES_MM: Record<PaperSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
}

function tileCount(length: number, printableLength: number, overlap: number) {
  if (length <= printableLength) return 1
  return Math.ceil((length - overlap) / (printableLength - overlap))
}

export function computePrintLayout(
  bounds: NetBounds,
  settings: PrintSettings,
): PrintLayout {
  const paper = PAPER_SIZES_MM[settings.paperSize]
  const pageWidthMm =
    settings.orientation === 'portrait' ? paper.width : paper.height
  const pageHeightMm =
    settings.orientation === 'portrait' ? paper.height : paper.width
  const { marginMm, overlapMm } = settings
  if (
    ![
      marginMm,
      overlapMm,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    ].every(Number.isFinite) ||
    marginMm < 0 ||
    overlapMm < 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    throw new RangeError(
      'Print settings and net bounds must be finite and non-negative.',
    )
  }

  const printableWidthMm = pageWidthMm - marginMm * 2
  const printableHeightMm = pageHeightMm - marginMm * 2
  if (
    printableWidthMm <= 0 ||
    printableHeightMm <= 0 ||
    overlapMm >= printableWidthMm ||
    overlapMm >= printableHeightMm
  ) {
    throw new RangeError('Margins and overlap leave no printable page area.')
  }

  const columns = tileCount(bounds.width, printableWidthMm, overlapMm)
  const rows = tileCount(bounds.height, printableHeightMm, overlapMm)
  const stepX = printableWidthMm - overlapMm
  const stepY = printableHeightMm - overlapMm
  const tiles: PrintTile[] = []
  const maxX = bounds.x + bounds.width
  const maxY = bounds.y + bounds.height

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const origin = {
        x: bounds.x + columnIndex * stepX,
        y: bounds.y + rowIndex * stepY,
      }
      const visibleBounds = {
        x: origin.x,
        y: origin.y,
        width: Math.max(0, Math.min(printableWidthMm, maxX - origin.x)),
        height: Math.max(0, Math.min(printableHeightMm, maxY - origin.y)),
      }
      const guides: RegistrationGuide[] = []
      if (columnIndex < columns - 1) {
        const nextOriginX = origin.x + stepX
        const point = {
          x: nextOriginX + overlapMm / 2,
          y: origin.y + Math.min(visibleBounds.height, printableHeightMm) / 2,
        }
        const label = `R${rowIndex + 1}C${columnIndex + 1}-R${rowIndex + 1}C${columnIndex + 2}`
        guides.push({ id: `vertical-${rowIndex}-${columnIndex}`, label, point })
      }
      if (rowIndex < rows - 1) {
        const nextOriginY = origin.y + stepY
        const point = {
          x: origin.x + Math.min(visibleBounds.width, printableWidthMm) / 2,
          y: nextOriginY + overlapMm / 2,
        }
        const label = `R${rowIndex + 1}C${columnIndex + 1}-R${rowIndex + 2}C${columnIndex + 1}`
        guides.push({
          id: `horizontal-${rowIndex}-${columnIndex}`,
          label,
          point,
        })
      }
      if (columnIndex > 0) {
        const nextOriginX = origin.x
        guides.push({
          id: `vertical-${rowIndex}-${columnIndex - 1}`,
          label: `R${rowIndex + 1}C${columnIndex}-R${rowIndex + 1}C${columnIndex + 1}`,
          point: {
            x: nextOriginX + overlapMm / 2,
            y: origin.y + Math.min(visibleBounds.height, printableHeightMm) / 2,
          },
        })
      }
      if (rowIndex > 0) {
        const nextOriginY = origin.y
        guides.push({
          id: `horizontal-${rowIndex - 1}-${columnIndex}`,
          label: `R${rowIndex}C${columnIndex + 1}-R${rowIndex + 1}C${columnIndex + 1}`,
          point: {
            x: origin.x + Math.min(visibleBounds.width, printableWidthMm) / 2,
            y: nextOriginY + overlapMm / 2,
          },
        })
      }
      tiles.push({
        pageNumber: tiles.length + 1,
        row: rowIndex + 1,
        column: columnIndex + 1,
        origin,
        visibleBounds,
        guides,
      })
    }
  }

  return {
    settings,
    pageWidthMm,
    pageHeightMm,
    printableWidthMm,
    printableHeightMm,
    columns,
    rows,
    requiresMultiplePages: columns > 1 || rows > 1,
    tiles,
  }
}
