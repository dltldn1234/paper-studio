import { afterEach, expect, it, vi } from 'vitest'
import { RoarAudio } from './RoarAudio'

afterEach(() => vi.unstubAllGlobals())

it('never creates audio before an explicit toggle and closes the enabled context', async () => {
  const context = {
    state: 'running',
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }
  const constructor = vi.fn(function () {
    return context
  })
  vi.stubGlobal('AudioContext', constructor)
  const audio = new RoarAudio()
  audio.play()
  expect(constructor).not.toHaveBeenCalled()
  expect(await audio.toggle()).toBe(true)
  expect(constructor).toHaveBeenCalledTimes(1)
  expect(await audio.toggle()).toBe(false)
  audio.dispose()
  expect(context.close).toHaveBeenCalledTimes(1)
})
