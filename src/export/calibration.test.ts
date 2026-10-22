import { describe, expect, it } from 'vitest'
import {
  PDFArray,
  PDFDocument,
  PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib'
import {
  calculateCalibrationResult,
  createPdfCalibrationGuide,
  createSvgCalibrationGuide,
} from './calibration'
import { createCuboidNet } from '../geometry'
import { createPrintableNet } from './printable-net'
import { createTiledPdf, PDF_POINTS_PER_MM } from './pdf'

const encodedAscii = (value: string) =>
  Array.from(new TextEncoder().encode(value), (byte) =>
    byte.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase()

describe('print calibration geometry', () => {
  it('keeps the SVG line and square at exactly 100 mm with no clipping', () => {
    const guide = createSvgCalibrationGuide({
      x: 4,
      y: 8,
      width: 360,
      height: 220,
    })
    expect(guide.x).toBe(374)
    expect(guide.sizeMm).toBe(100)
    expect(guide.lineY - guide.y).toBe(105)
    expect(guide.bounds.x + guide.bounds.width).toBe(guide.x + 100)
    expect(guide.bounds.y + guide.bounds.height).toBeGreaterThanOrEqual(
      guide.lineY + 7,
    )
  })

  it.each([
    { width: 210, height: 297 },
    { width: 297, height: 210 },
    { width: 297, height: 420 },
    { width: 420, height: 297 },
  ])('fits A4/A3 page geometry $width × $height mm', ({ width, height }) => {
    const guide = createPdfCalibrationGuide(width, height, 10)
    expect(guide.square.sizeMm).toBe(100)
    expect(guide.diagonal.targetLengthMm).toBeCloseTo(Math.hypot(100, 100))
    expect(guide.lines.map((line) => line.x2 - line.x1)).toEqual([50, 100, 150])
    expect(guide.verticalLines.map((line) => line.y2 - line.y1)).toEqual([
      50, 100, 150,
    ])
    expect(guide.square.x).toBeGreaterThanOrEqual(10)
    expect(guide.square.x + guide.square.sizeMm).toBeLessThanOrEqual(width - 10)
    expect(
      Math.min(...guide.lines.map((line) => line.labelY)),
    ).toBeGreaterThanOrEqual(10)
    expect(guide.printableArea.width).toBe(width - 20)
    expect(guide.cutBoundary.x).toBe(15)
    expect(guide.registrationMarks).toHaveLength(4)
    expect(guide.alignmentMarks.map(({ label }) => label)).toEqual([
      'LEFT',
      'RIGHT',
      'BOTTOM',
      'TOP',
    ])
  })

  it('rejects calibration marks that exceed page margins', () => {
    expect(() => createPdfCalibrationGuide(140, 160, 30)).toThrow('do not fit')
    expect(() => createPdfCalibrationGuide(0, 297, 10)).toThrow('finite')
  })

  it('opens generated calibration PDF and validates A4 dimensions and mark coordinates', async () => {
    const net = createPrintableNet(
      createCuboidNet(
        { widthMm: 40, depthMm: 30, heightMm: 20 },
        { enabled: true, widthMm: 6, angleDeg: 45 },
      ),
    )
    const bytes = await createTiledPdf(
      net,
      {
        paperSize: 'A4',
        orientation: 'portrait',
        marginMm: 10,
        overlapMm: 5,
      },
      'Advanced calibration sheet',
    )
    const document = await PDFDocument.load(bytes)
    const sheet = document.getPages().at(-1)
    expect(sheet).toBeDefined()
    expect(sheet?.getWidth()).toBeCloseTo(210 * PDF_POINTS_PER_MM, 4)
    expect(sheet?.getHeight()).toBeCloseTo(297 * PDF_POINTS_PER_MM, 4)

    const contents = sheet?.node.Contents()
    const items = contents instanceof PDFArray ? contents.asArray() : [contents]
    const commands = items
      .filter((item) => item !== undefined)
      .map((item) => document.context.lookup(item))
      .filter((item): item is PDFRawStream => item instanceof PDFRawStream)
      .map((stream) =>
        new TextDecoder().decode(decodePDFRawStream(stream).decode()),
      )
      .join('\n')
    const numericCommands = commands.replace(/<[^>]*>/g, '')
    const values = (numericCommands.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
    const hasMmCoordinate = (millimeters: number) =>
      values.some(
        (value) => Math.abs(value - millimeters * PDF_POINTS_PER_MM) < 0.001,
      )
    expect(commands).toContain(encodedAscii('PRINTABLE AREA'))
    expect(commands).toContain(encodedAscii('CUT REFERENCE'))
    expect(commands).toContain(encodedAscii('Print at Actual Size / 100%'))
    expect(hasMmCoordinate(30)).toBe(true)
    expect(hasMmCoordinate(167)).toBe(true)
    expect(hasMmCoordinate(100)).toBe(true)
    expect(commands).toContain(encodedAscii('141.42 mm diagonal'))
  })

  it('calculates output scale and distinguishes an uncorrected print scale', () => {
    expect(calculateCalibrationResult(100, 99.5)).toMatchObject({
      outputScalePercent: 99.5,
      scaleErrorPercent: -0.5,
      status: 'within-tolerance',
    })
    expect(calculateCalibrationResult(150, 147)).toMatchObject({
      outputScalePercent: 98,
      scaleErrorPercent: -2,
      status: 'adjust-print-scale',
    })
    expect(() => calculateCalibrationResult(50, 0)).toThrow(
      'finite and positive',
    )
  })
})
