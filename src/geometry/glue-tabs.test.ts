import { describe, expect, it } from 'vitest'
import {
  createCuboidNet,
  findGlueTabInterferences,
  generateGlueTabs,
  type GlueTab,
} from './index'

const dimensions = { widthMm: 100, depthMm: 80, heightMm: 60 }
const enabled = { enabled: true, widthMm: 10, angleDeg: 45 }

describe('cuboid net glue tabs', () => {
  it('adds one tab for each exposed cut edge and includes them in net bounds', () => {
    const net = createCuboidNet(dimensions, enabled)
    expect(net.glueTabs).toHaveLength(7)
    expect(net.glueTabs.every((tab) => tab.widthMm === 10)).toBe(true)
    expect(net.glueTabs.every((tab) => tab.angleDeg === 45)).toBe(true)
    expect(net.glueTabs.every((tab) => tab.faceId.length > 0)).toBe(true)
    expect(net.glueTabs.every((tab) => tab.polygon.vertices.length === 4)).toBe(
      true,
    )
    expect(net.bounds).toEqual({ x: 0, y: 0, width: 370, height: 220 })
    expect(net.tabInterferences).toEqual([])
    const tabConnections = net.glueTabs
      .map((tab) => {
        const edge = net.edges.find(({ id }) => id === tab.edgeId)
        return edge?.adjacentFaceIds.slice().sort().join('-')
      })
      .sort()
    expect(tabConnections).toEqual(
      [
        'back-bottom',
        'back-left',
        'back-top',
        'left-top',
        'right-top',
        'bottom-left',
        'bottom-right',
      ].sort(),
    )
  })

  it('can omit tabs and keeps the original face-only boundary', () => {
    const net = createCuboidNet(dimensions)

    expect(net.glueTabs).toEqual([])
    expect(net.bounds).toEqual({ x: 0, y: 0, width: 360, height: 220 })
  })

  it('honors a custom width and bevel angle', () => {
    const net = createCuboidNet(dimensions, {
      enabled: true,
      widthMm: 6,
      angleDeg: 35,
    })

    expect(net.glueTabs[0]).toMatchObject({ widthMm: 6, angleDeg: 35 })
    expect(net.bounds.width).toBeGreaterThan(360)
  })

  it('supports rectangular and beveled tab outlines with explicit direction', () => {
    const edge = {
      id: 'cut',
      hostFaceId: 'front' as const,
      kind: 'cut' as const,
      adjacentFaceIds: ['front' as const, 'right' as const],
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
    }
    const rectangular = generateGlueTabs([edge], {
      ...enabled,
      shape: 'rectangular',
    }).tabs[0]
    const beveled = generateGlueTabs([edge], {
      ...enabled,
      shape: 'beveled',
    }).tabs[0]
    const inward = generateGlueTabs([edge], {
      ...enabled,
      direction: 'inward',
    }).tabs[0]

    expect(rectangular.shape).toBe('rectangular')
    expect(rectangular.polygon.vertices[2].x).toBe(100)
    expect(beveled.shape).toBe('beveled')
    expect(beveled.polygon.vertices[2].x).toBe(95)
    expect(inward.direction).toBe('inward')
    expect(inward.polygon.vertices[2].y).toBeGreaterThan(0)
  })

  it.each([
    { enabled: true, widthMm: 0, angleDeg: 45 },
    { enabled: true, widthMm: 51, angleDeg: 45 },
    { enabled: true, widthMm: 10, angleDeg: 0 },
    { enabled: true, widthMm: 10, angleDeg: 90 },
    { enabled: true, widthMm: Number.NaN, angleDeg: 45 },
  ])('rejects invalid tab options %o', (options) => {
    expect(() => createCuboidNet(dimensions, options)).toThrow(RangeError)
  })

  it('reports polygon overlap between tabs', () => {
    const first: GlueTab = {
      id: 'tab-a',
      edgeId: 'edge-a',
      faceId: 'front',
      widthMm: 10,
      angleDeg: 45,
      polygon: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 8, y: 5 },
          { x: 2, y: 5 },
        ],
      },
    }
    const second: GlueTab = {
      ...first,
      id: 'tab-b',
      edgeId: 'edge-b',
      polygon: {
        vertices: [
          { x: 5, y: 2 },
          { x: 15, y: 2 },
          { x: 13, y: 7 },
          { x: 7, y: 7 },
        ],
      },
    }

    expect(findGlueTabInterferences([first, second])).toEqual([
      { kind: 'tab-tab', firstTabId: 'tab-a', secondTabId: 'tab-b' },
    ])
  })

  it('reports a tab that overlaps a non-host face', () => {
    const tab: GlueTab = {
      id: 'tab-a',
      edgeId: 'edge-a',
      faceId: 'front',
      widthMm: 10,
      angleDeg: 45,
      polygon: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 8, y: 5 },
          { x: 2, y: 5 },
        ],
      },
    }
    const overlappingFace = {
      id: 'right' as const,
      label: 'right',
      widthMm: 6,
      heightMm: 4,
      origin: { x: 3, y: 2 },
      edgeNeighborIds: ['front', 'back', 'top', 'bottom'] as [
        'front',
        'back',
        'top',
        'bottom',
      ],
      polygon: {
        vertices: [
          { x: 3, y: 2 },
          { x: 9, y: 2 },
          { x: 9, y: 6 },
          { x: 3, y: 6 },
        ],
      },
    }

    expect(findGlueTabInterferences([tab], [overlappingFace])).toEqual([
      { kind: 'tab-face', tabId: 'tab-a', faceId: 'right' },
    ])
  })

  it('generates no tabs when the option is disabled', () => {
    const edge = {
      id: 'cut',
      hostFaceId: 'front' as const,
      kind: 'cut' as const,
      adjacentFaceIds: ['front' as const, 'right' as const],
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
    }
    expect(
      generateGlueTabs([edge], { ...enabled, enabled: false }).tabs,
    ).toEqual([])
  })
})
