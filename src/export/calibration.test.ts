import { describe, expect, it } from 'vitest'
import {
  calculateCalibrationResult,
  createPdfCalibrationGuide,
  createSvgCalibrationGuide,
} from './calibration'

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
    expect(guide.lines.map((line) => line.x2 - line.x1)).toEqual([50, 100, 150])
    expect(guide.verticalLines.map((line) => line.y2 - line.y1)).toEqual([
      50, 100, 150,
    ])
    expect(guide.square.x).toBeGreaterThanOrEqual(10)
    expect(guide.square.x + guide.square.sizeMm).toBeLessThanOrEqual(width - 10)
    expect(
      Math.min(...guide.lines.map((line) => line.labelY)),
    ).toBeGreaterThanOrEqual(10)
  })

  it('rejects calibration marks that exceed page margins', () => {
    expect(() => createPdfCalibrationGuide(140, 160, 30)).toThrow('do not fit')
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
