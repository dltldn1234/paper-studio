import { describe, expect, it } from 'vitest'
import { createCuboidNet } from '../geometry'
import { createPrintableNet } from './printable-net'
import { computePrintLayout } from './print-layout'
import { runPrintPreflight } from './preflight'

const settings = {
  paperSize: 'A4' as const,
  orientation: 'portrait' as const,
  marginMm: 10,
  overlapMm: 8,
  showCutLines: true,
  showFoldLines: true,
}
const printable = createPrintableNet(
  createCuboidNet(
    { widthMm: 80, depthMm: 60, heightMm: 40 },
    { enabled: true, widthMm: 10, angleDeg: 45 },
  ),
)

function layoutFor(
  width = printable.bounds.width,
  height = printable.bounds.height,
) {
  return computePrintLayout({ ...printable.bounds, width, height }, settings)
}

describe('PDF print preflight', () => {
  it('reports line style information and complete page coverage', () => {
    const report = runPrintPreflight(printable, layoutFor())
    expect(report.hasErrors).toBe(false)
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: 'line-styles', severity: 'info' }),
    )
    expect(report.pageCount).toBeGreaterThan(1)
  })

  it('reports tab-to-face and tab-to-tab overlap as warnings', () => {
    const withOverlaps = {
      ...printable,
      tabInterferences: [
        { kind: 'tab-face' as const, tabId: 'tab-a', faceId: 'face-b' },
        { kind: 'tab-tab' as const, firstTabId: 'tab-a', secondTabId: 'tab-b' },
      ],
    }
    const issues = runPrintPreflight(withOverlaps, layoutFor()).issues
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'tab-face-overlap',
          severity: 'warning',
        }),
        expect.objectContaining({
          code: 'tab-tab-overlap',
          severity: 'warning',
        }),
      ]),
    )
  })

  it('blocks missing tile pages and geometry outside every printable page', () => {
    const layout = layoutFor()
    const missingTile = { ...layout, tiles: layout.tiles.slice(1) }
    expect(runPrintPreflight(printable, missingTile).issues).toContainEqual(
      expect.objectContaining({ code: 'missing-tile-page', severity: 'error' }),
    )
    const tooSmall = {
      ...layout,
      tiles: layout.tiles.map((tile) => ({
        ...tile,
        visibleBounds: {
          ...tile.visibleBounds,
          width: tile.visibleBounds.width / 2,
        },
      })),
    }
    expect(runPrintPreflight(printable, tooSmall).issues).toContainEqual(
      expect.objectContaining({
        code: 'page-boundary-overflow',
        severity: 'error',
      }),
    )
  })

  it('rejects invalid PDF image data and warns for low-resolution textures', () => {
    const malformed = runPrintPreflight(printable, layoutFor(), {
      front: {
        color: '#ffffff',
        texture: {
          dataUrl: 'data:image/webp;base64,%%%invalid',
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          rotationDeg: 0,
        },
      },
    })
    expect(malformed.issues).toContainEqual(
      expect.objectContaining({
        code: 'invalid-pdf-texture',
        severity: 'error',
      }),
    )

    const lowResolution = runPrintPreflight(printable, layoutFor(), {
      front: {
        color: '#ffffff',
        texture: {
          dataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          rotationDeg: 0,
        },
      },
    })
    expect(lowResolution.issues).toContainEqual(
      expect.objectContaining({
        code: 'low-image-resolution',
        severity: 'warning',
      }),
    )
  })

  it('blocks texture transforms that would create an excessive image repeat count', () => {
    const report = runPrintPreflight(printable, layoutFor(), {
      front: {
        color: '#ffffff',
        texture: {
          dataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
          offsetX: 0,
          offsetY: 0,
          scale: 0.01,
          rotationDeg: 0,
        },
      },
    })
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'texture-repeat-overflow',
        severity: 'error',
      }),
    )
  })

  it('reports hidden cut and fold lines and invalid unit conversion', () => {
    const hidden = {
      ...layoutFor(),
      settings: { ...settings, showCutLines: false, showFoldLines: false },
    }
    const report = runPrintPreflight(printable, hidden)
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'cut-lines-not-identifiable',
          severity: 'warning',
        }),
        expect.objectContaining({
          code: 'fold-lines-not-identifiable',
          severity: 'warning',
        }),
      ]),
    )
    expect(
      runPrintPreflight(printable, { ...layoutFor(), pageWidthMm: Number.NaN })
        .issues,
    ).toContainEqual(
      expect.objectContaining({
        code: 'invalid-mm-conversion',
        severity: 'error',
      }),
    )
  })
})
