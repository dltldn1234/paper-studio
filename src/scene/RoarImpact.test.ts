import { expect, it } from 'vitest'
import { Quaternion, Vector3 } from 'three'
import { createRoarImpact, roarImpactFrame } from './RoarImpact'
import { disposeScene } from './disposeScene'

it('stages impact after jaw release and dissipates before idle', () => {
  expect(roarImpactFrame(5.5).visible).toBe(false)
  expect(roarImpactFrame(6.1).opacity).toBeGreaterThan(0.9)
  expect(roarImpactFrame(7.5).visible).toBe(false)
  expect(roarImpactFrame(6.1, true).opacity).toBe(0)
  expect(roarImpactFrame(6.1, true).visible).toBe(false)
})

it('resets on replay, follows the mouth and hides all motion for reduced mode', () => {
  const impact = createRoarImpact()
  const mouth = new Vector3(3, 4, 0.2)
  const orientation = new Quaternion()
  impact.update(6.1, false, mouth, orientation)
  expect(impact.group.visible).toBe(true)
  expect(impact.group.children[1].position.equals(mouth)).toBe(true)
  const scale = impact.group.children[0].scale.clone()
  impact.update(6.1, false, mouth, orientation)
  expect(impact.group.children[0].scale.equals(scale)).toBe(true)
  impact.update(0, false, mouth, orientation)
  expect(impact.group.visible).toBe(false)
  impact.update(6.1, true, mouth, orientation)
  expect(impact.group.visible).toBe(false)
  impact.setQuality(true)
  disposeScene(impact.group)
  expect(impact.group.children).toHaveLength(0)
})
