import { expect, it } from 'vitest'
import { Vector3 } from 'three'
import { paperLoft } from './dinosaurGeometry'
import { HingePanels } from './HingePanels'

it('reconstructs the source, flattens to a plane, and preserves rigid face lengths', () => {
  const source = paperLoft(
    [
      { x: 0, height: 1, width: 1 },
      { x: 2, height: 1.4, width: 0.8 },
    ],
    6,
  )
  const hinges = new HingePanels(source)
  const original = source.getAttribute('position')
  const index = source.getIndex()!
  const rest = hinges.geometry.getAttribute('position')
  for (let i = 0; i < index.count; i++) {
    expect(
      new Vector3()
        .fromBufferAttribute(rest, i)
        .distanceTo(new Vector3().fromBufferAttribute(original, index.getX(i))),
    ).toBeLessThan(1e-6)
  }
  for (const unfold of [0.25, 0.5, 0.75, 1]) {
    hinges.update(unfold)
    const position = hinges.geometry.getAttribute('position')
    for (let face = 0; face < index.count; face += 3) {
      const a = new Vector3().fromBufferAttribute(position, face)
      const b = new Vector3().fromBufferAttribute(position, face + 1)
      const originalA = new Vector3().fromBufferAttribute(
        original,
        index.getX(face),
      )
      const originalB = new Vector3().fromBufferAttribute(
        original,
        index.getX(face + 1),
      )
      expect(a.distanceTo(b)).toBeCloseTo(originalA.distanceTo(originalB), 5)
    }
    if (unfold === 1) {
      const y = Array.from({ length: position.count }, (_, i) =>
        position.getY(i),
      )
      expect(Math.max(...y) - Math.min(...y)).toBeLessThan(1e-5)
    }
  }
  source.dispose()
  hinges.geometry.dispose()
})
