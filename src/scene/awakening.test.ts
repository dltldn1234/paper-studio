import { expect, it } from 'vitest'
import { awakeningFrame } from './awakening'

it('lifts the head before opening the jaw and recovers by the reveal', () => {
  expect(awakeningFrame(5).pose.jawOpen).toBe(0)
  expect(awakeningFrame(5.5).pose.headLift).toBeGreaterThan(0.8)
  expect(awakeningFrame(5.5).pose.jawOpen).toBe(0)
  expect(awakeningFrame(6.05).pose.jawOpen).toBeGreaterThan(0.95)
  expect(awakeningFrame(7).pose.jawOpen).toBe(0)
  expect(awakeningFrame(7).pose.headLift).toBe(0)
})

it('limits camera vibration to the roar pulse and disables it for reduced motion', () => {
  for (let seconds = 0; seconds <= 10; seconds += 0.01) {
    const frame = awakeningFrame(seconds)
    expect(Math.abs(frame.cameraImpulse)).toBeLessThanOrEqual(0.052)
    if (seconds < 5.9 || seconds > 6.45) expect(frame.cameraImpulse).toBe(0)
    const reduced = awakeningFrame(seconds, true)
    expect(reduced.cameraImpulse).toBe(0)
    expect(reduced.pose.jawOpen).toBe(0)
    expect(reduced.lightPulse).toBe(0)
  }
})

it('loads weight before the roar and transfers recoil through the body and tail', () => {
  expect(awakeningFrame(5.55).pose.crouch).toBeGreaterThan(0.6)
  const roar = awakeningFrame(6.02).pose
  expect(roar.neckRecoil).toBeGreaterThan(0.3)
  expect(roar.tailLift).toBeGreaterThan(0.4)
  expect(roar.bodyLean).toBeGreaterThan(0.5)
})
