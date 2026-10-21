import { PDFDocument, PrintScaling } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import {
  createCuboidNet,
  createRegularTetrahedron,
  unfoldPolyhedron,
} from '../geometry'
import { createPrintableNet } from './printable-net'
import { createPrintLayout, createTiledPdf, PDF_POINTS_PER_MM } from './pdf'
import { computePrintLayout } from './print-layout'

const net = createCuboidNet(
  { widthMm: 100, depthMm: 80, heightMm: 60 },
  { enabled: true, widthMm: 10, angleDeg: 45 },
)

describe('printable PDF export', () => {
  it('creates exact A4 portrait page sizes and tiles oversized nets', async () => {
    const bytes = await createTiledPdf(net, {
      paperSize: 'A4',
      orientation: 'portrait',
      marginMm: 10,
      overlapMm: 8,
    })
    const document = await PDFDocument.load(bytes)
    expect(document.getPages()).toHaveLength(3)
    expect(document.getPages()[0].getWidth()).toBeCloseTo(
      210 * PDF_POINTS_PER_MM,
      4,
    )
    expect(document.getPages()[0].getHeight()).toBeCloseTo(
      297 * PDF_POINTS_PER_MM,
      4,
    )
    expect(
      document.catalog.getOrCreateViewerPreferences().getPrintScaling(),
    ).toBe(PrintScaling.None)
  })

  it('creates a single exact A3 landscape page when the net fits', async () => {
    const bytes = await createTiledPdf(net, {
      paperSize: 'A3',
      orientation: 'landscape',
      marginMm: 10,
      overlapMm: 8,
    })
    const document = await PDFDocument.load(bytes)
    expect(document.getPages()).toHaveLength(2)
    expect(document.getPages()[0].getWidth()).toBeCloseTo(
      420 * PDF_POINTS_PER_MM,
      4,
    )
    expect(document.getPages()[0].getHeight()).toBeCloseTo(
      297 * PDF_POINTS_PER_MM,
      4,
    )
  })

  it('reports overflow before rendering and uses page overlap for assembly guides', () => {
    const layout = computePrintLayout(net.bounds, {
      paperSize: 'A4',
      orientation: 'portrait',
      marginMm: 10,
      overlapMm: 8,
    })
    expect(layout.requiresMultiplePages).toBe(true)
    expect(layout.tiles[0].guides).toHaveLength(1)
    expect(layout.tiles[1].guides).toHaveLength(1)
    expect(layout.tiles[0].guides[0].point).toEqual(
      layout.tiles[1].guides[0].point,
    )
  })

  it.each(['A4', 'A3'] as const)(
    'tiles a tabbed tetrahedron on exact %s PDF pages',
    async (paperSize) => {
      const unfolded = unfoldPolyhedron(createRegularTetrahedron(100))
      expect(unfolded.success).toBe(true)
      if (!unfolded.success) return
      const printable = createPrintableNet(unfolded.layout, {
        enabled: true,
        widthMm: 10,
        angleDeg: 45,
      })
      const settings = {
        paperSize,
        orientation: 'portrait' as const,
        marginMm: 10,
        overlapMm: 8,
      }
      const layout = createPrintLayout(printable, settings)
      const bytes = await createTiledPdf(printable, settings, 'Tetrahedron')
      const document = await PDFDocument.load(bytes)
      const paperWidthMm = paperSize === 'A4' ? 210 : 297
      const paperHeightMm = paperSize === 'A4' ? 297 : 420

      expect(printable.glueTabs).toHaveLength(3)
      expect(document.getPages()).toHaveLength(layout.tiles.length + 1)
      expect(document.getPages()[0].getWidth()).toBeCloseTo(
        paperWidthMm * PDF_POINTS_PER_MM,
        4,
      )
      expect(document.getPages()[0].getHeight()).toBeCloseTo(
        paperHeightMm * PDF_POINTS_PER_MM,
        4,
      )
      expect(
        document.catalog.getOrCreateViewerPreferences().getPrintScaling(),
      ).toBe(PrintScaling.None)
    },
  )
})
