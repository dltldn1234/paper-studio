import { expect, it } from 'vitest'
import { awakeningFrame } from './awakening'

it('lifts the head before opening the jaw and recovers by the reveal', () => {
  expect(awakeningFrame(5).pose.jawOpen).toBe(0)
  expect(awakeningFrame(5.5).pose.headLift).toBeGreaterThan(0.8)
  expect(awakeningFrame(5.5).pose.jawOpen).toBe(0)
  expect(awakeningFrame(6.05).pose.jawOpen).toBe(1)
  expect(awakeningFrame(7).pose.jawOpen).toBe(0)
  expect(awakeningFrame(7).pose.headLift).toBe(0)
})

it('limits camera vibration to the roar pulse and disables it for reduced motion', () => {
  for (let seconds = 0; seconds <= 10; seconds += 0.01) {
    const frame = awakeningFrame(seconds)
    expect(Math.abs(frame.cameraImpulse)).toBeLessThanOrEqual(0.012)
    if (seconds < 5.95 || seconds > 6.2) expect(frame.cameraImpulse).toBe(0)
    const reduced = awakeningFrame(seconds, true)
    expect(reduced.cameraImpulse).toBe(0)
    expect(reduced.pose.jawOpen).toBe(0)
    expect(reduced.lightPulse).toBe(0)
  }
})
