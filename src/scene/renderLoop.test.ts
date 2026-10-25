import { afterEach, expect, it, vi } from 'vitest'
import { startRenderLoop } from './renderLoop'

afterEach(() => vi.restoreAllMocks())

it('freezes hidden time, resumes without a jump, and releases its frame', () => {
  let hidden = false
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
  const pending = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    pending.set(++id, callback)
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((key) => {
    pending.delete(key)
  })
  const advance = (timestamp: number) => {
    const [key, callback] = [...pending][0]
    pending.delete(key)
    callback(timestamp)
  }
  const render = vi.fn()
  const stop = startRenderLoop(render)
  advance(100)
  advance(150)
  expect(render).toHaveBeenLastCalledWith({ elapsed: 0.05, delta: 0.05 })
  hidden = true
  document.dispatchEvent(new Event('visibilitychange'))
  expect(pending.size).toBe(0)
  hidden = false
  document.dispatchEvent(new Event('visibilitychange'))
  advance(10000)
  expect(render).toHaveBeenLastCalledWith({ elapsed: 0.05, delta: 0 })
  advance(20000)
  expect(render).toHaveBeenLastCalledWith({
    elapsed: 0.15000000000000002,
    delta: 0.1,
  })
  stop()
  stop()
  expect(pending.size).toBe(0)
  document.dispatchEvent(new Event('visibilitychange'))
  expect(pending.size).toBe(0)
})
