import { expect, it } from 'vitest'
import { Box3 } from 'three'
import { createPaperDinosaur } from './PaperDinosaur'
import { paperLoft } from './dinosaurGeometry'
import { disposeScene } from './disposeScene'

it.each(['low', 'high'] as const)(
  'builds finite closed paper panels at %s quality',
  (quality) => {
    const dinosaur = createPaperDinosaur(quality)
    expect(dinosaur.panels.map((panel) => panel.name)).toEqual(
      expect.arrayContaining([
        'ribcage',
        'skull',
        'lower-jaw',
        'counterbalance-tail',
        'haunch',
        'shin',
        'toe',
      ]),
    )
    for (const mesh of dinosaur.panels) {
      const position = mesh.geometry.getAttribute('position')
      expect([...position.array].every(Number.isFinite)).toBe(true)
      const index = mesh.geometry.getIndex()!
      const edges = new Map<string, number>()
      for (let i = 0; i < index.count; i += 3) {
        const face = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
        for (let edge = 0; edge < 3; edge++) {
          const key = [face[edge], face[(edge + 1) % 3]]
            .sort((a, b) => a - b)
            .join(':')
          edges.set(key, (edges.get(key) ?? 0) + 1)
        }
      }
      expect([...edges.values()].every((count) => count === 2)).toBe(true)
    }
    for (const leg of dinosaur.legs) {
      const footHeight = new Box3().setFromObject(leg).min.y
      expect(footHeight).toBeGreaterThanOrEqual(0)
      expect(footHeight).toBeLessThan(0.04)
    }
    const bounds = new Box3().setFromObject(dinosaur.root)
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(7)
    expect(bounds.max.y).toBeGreaterThan(4)
    expect(dinosaur.jaw.parent).toBe(dinosaur.head)
    disposeScene(dinosaur.root)
  },
)

it('rejects malformed loft dimensions', () => {
  expect(() => paperLoft([])).toThrow()
  expect(() =>
    paperLoft([
      { x: 0, height: 0, width: 1 },
      { x: 1, height: 1, width: 1 },
    ]),
  ).toThrow()
})
