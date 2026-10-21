import { describe, expect, it } from 'vitest'
import { createCuboidNet } from '../geometry'
import { computePrintLayout } from './print-layout'
import { createPrintableNet, scalePrintableNet } from './printable-net'
import {
  createCorrectedPrintableNet,
  scaleFaceMaterialOffsets,
  validatePdfCalibrationSelection,
} from './precision-export'
import { createPrintLayout, createTiledPdf, PDF_POINTS_PER_MM } from './pdf'
import { PDFDocument } from 'pdf-lib'

const source = createPrintableNet(
  createCuboidNet(
    { widthMm: 100, depthMm: 80, heightMm: 60 },
    { enabled: true, widthMm: 10, angleDeg: 45 },
  ),
)
const settings = {
  paperSize: 'A4' as const,
  orientation: 'portrait' as const,
  marginMm: 10,
  overlapMm: 8,
}

describe('precision PDF geometry', () => {
  it('applies one global X/Y transform to faces, edges, tabs and bounds', () => {
    const corrected = scalePrintableNet(source, 1.02, 0.99)
    const centerX = source.bounds.x + source.bounds.width / 2
    const centerY = source.bounds.y + source.bounds.height / 2
    const point = source.faces[0].polygon[0]
    expect(corrected.faces[0].polygon[0]).toEqual({
      x: centerX + (point.x - centerX) * 1.02,
      y: centerY + (point.y - centerY) * 0.99,
    })
    expect(corrected.edges[0].start.x).not.toBe(source.edges[0].start.x)
    expect(corrected.glueTabs[0].polygon.vertices).not.toEqual(
      source.glueTabs[0].polygon.vertices,
    )
    expect(corrected.bounds.width).toBeCloseTo(source.bounds.width * 1.02)
    expect(corrected.bounds.height).toBeCloseTo(source.bounds.height * 0.99)
  })

  it('keeps paper dimensions fixed while recalculating corrected tiling', async () => {
    const selection = { profileId: 'office-a4', xScale: 1.02, yScale: 0.99 }
    const originalLayout = computePrintLayout(source.bounds, settings)
    const correctedLayout = createPrintLayout(source, settings, selection)
    expect(correctedLayout.pageWidthMm).toBe(originalLayout.pageWidthMm)
    expect(correctedLayout.pageHeightMm).toBe(originalLayout.pageHeightMm)
    expect(correctedLayout.tiles.length).toBeGreaterThanOrEqual(
      originalLayout.tiles.length,
    )

    const pdf = await createTiledPdf(source, settings, 'Corrected', {
      calibration: selection,
    })
    const document = await PDFDocument.load(pdf)
    expect(document.getSubject()).toContain('office-a4')
    for (const page of document.getPages()) {
      expect(page.getWidth()).toBeCloseTo(210 * PDF_POINTS_PER_MM, 4)
      expect(page.getHeight()).toBeCloseTo(297 * PDF_POINTS_PER_MM, 4)
    }

    const texturedBytes = await createTiledPdf(
      source,
      settings,
      'Corrected texture and glue tabs',
      {
        calibration: selection,
        faceMaterials: {
          front: {
            color: '#aabbcc',
            texture: {
              dataUrl:
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
              offsetX: 2,
              offsetY: 3,
              scale: 1,
              rotationDeg: 15,
            },
          },
        },
      },
    )
    const texturedDocument = await PDFDocument.load(texturedBytes)
    expect(texturedDocument.getPages()).toHaveLength(
      correctedLayout.tiles.length + 1,
    )
  })

  it('rejects duplicate and out-of-range correction selections', () => {
    expect(() =>
      validatePdfCalibrationSelection({
        profileId: 'office-a4',
        xScale: 1,
        yScale: 1,
        alreadyAppliedProfileIds: ['office-a4'],
      }),
    ).toThrow('already been applied')
    expect(() =>
      createCorrectedPrintableNet(source, {
        profileId: 'office-a4',
        xScale: 2.1,
        yScale: 1,
      }),
    ).toThrow('between 0.5 and 2')
  })

  it('keeps face texture offsets in the same calibrated coordinate transform', () => {
    const materials = scaleFaceMaterialOffsets(
      {
        front: {
          color: '#aabbcc',
          texture: {
            dataUrl: 'data:image/png;base64,AA==',
            offsetX: 10,
            offsetY: 20,
            scale: 0.5,
            rotationDeg: 30,
          },
        },
      },
      { profileId: 'office', xScale: 1.02, yScale: 0.99 },
    )
    expect(materials.front.texture).toMatchObject({
      offsetX: 10.2,
      offsetY: 19.8,
      scale: 0.5,
      rotationDeg: 30,
    })
  })

  it('blocks correction when its calibration marks cannot fit the page', async () => {
    await expect(
      createTiledPdf(source, settings, 'Oversized correction', {
        calibration: { profileId: 'oversized', xScale: 1.9, yScale: 1.9 },
      }),
    ).rejects.toThrow('calibration marks exceed')
  })
})
