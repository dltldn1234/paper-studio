import { beforeEach, expect, it } from 'vitest'
import {
  readMotionPreferences,
  saveMotionPreferences,
} from './motion-preferences'

beforeEach(() => localStorage.clear())

it('replays the upgraded cinematic once without losing the motion preference', () => {
  localStorage.setItem(
    'paper-studio.motion-preferences.v1',
    JSON.stringify({ seen: true, reduce: true }),
  )
  expect(readMotionPreferences()).toEqual({ seen: false, reduce: true })
  saveMotionPreferences({ seen: true })
  expect(readMotionPreferences()).toEqual({ seen: true, reduce: true })
  saveMotionPreferences({ reduce: false })
  expect(readMotionPreferences()).toEqual({ seen: true, reduce: false })
})

it('recovers malformed preferences without blocking first playback', () => {
  localStorage.setItem('paper-studio.motion-preferences.v1', '{bad')
  expect(readMotionPreferences()).toEqual({ seen: false, reduce: null })
})
