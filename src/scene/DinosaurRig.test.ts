import { expect, it } from 'vitest'
import { createPaperDinosaur } from './PaperDinosaur'
import { DinosaurRig, idlePose } from './DinosaurRig'
import { disposeScene } from './disposeScene'

it('poses linked joints without drift and returns to the bind pose', () => {
  const model = createPaperDinosaur('low')
  const rig = new DinosaurRig(model)
  const rest = model.head.quaternion.clone()
  const pose = { headLift: 1, jawOpen: 1, bodyLean: 0.5, breath: 1 }
  rig.apply(pose)
  const jaw = model.jaw.matrixWorld.clone()
  for (let i = 0; i < 100; i++) rig.apply(pose)
  expect(model.jaw.matrixWorld.equals(jaw)).toBe(true)
  expect(model.head.quaternion.equals(rest)).toBe(false)
  expect(model.jaw.rotation.z).toBeCloseTo(-0.42)
  rig.apply()
  expect(model.head.quaternion.equals(rest)).toBe(true)
  expect(model.jaw.rotation.z).toBeCloseTo(0)
  disposeScene(model.root)
})

it('keeps reduced motion static and idle amplitudes subtle', () => {
  expect(idlePose(1, true)).toEqual(idlePose(500, true))
  const pose = idlePose(4)
  expect(Math.abs(pose.breath)).toBeLessThanOrEqual(1)
  expect(Math.abs(pose.headLift)).toBeLessThanOrEqual(0.035)
})
