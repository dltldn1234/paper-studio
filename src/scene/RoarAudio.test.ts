import { afterEach, expect, it, vi } from 'vitest'
import { RoarAudio } from './RoarAudio'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('cancels every layered voice and disconnects the whole audio graph', async () => {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  })
  const nodes: ReturnType<typeof makeNode>[] = []
  function makeNode() {
    const value = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      gain: param(),
      frequency: param(),
      Q: param(),
      threshold: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      onended: null as (() => void) | null,
    }
    return value
  }
  const node = () => {
    const value = makeNode()
    nodes.push(value)
    return value
  }
  const context = {
    state: 'running',
    sampleRate: 48000,
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createGain: node,
    createOscillator: node,
    createBiquadFilter: node,
    createDynamicsCompressor: node,
    createConvolver: node,
    createBufferSource: node,
    createBuffer: (_channels: number, frames: number) => ({
      getChannelData: () => new Float32Array(frames),
    }),
  }
  vi.stubGlobal(
    'AudioContext',
    vi.fn(function () {
      return context
    }),
  )
  const audio = new RoarAudio()
  await audio.toggle()
  audio.play()
  const sources = nodes.filter((value) => value.start.mock.calls.length > 0)
  expect(sources).toHaveLength(4)
  audio.stop()
  for (const source of sources) expect(source.stop).toHaveBeenCalledTimes(2)
  for (const value of nodes) expect(value.disconnect).toHaveBeenCalledTimes(1)
  vi.useFakeTimers()
  const previousCount = nodes.length
  audio.play()
  const nextSources = nodes
    .slice(previousCount)
    .filter((value) => value.start.mock.calls.length > 0)
  for (const source of nextSources) source.onended?.()
  expect(vi.getTimerCount()).toBe(1)
  audio.stop()
  expect(vi.getTimerCount()).toBe(0)
  vi.runAllTimers()
  for (const value of nodes) expect(value.disconnect).toHaveBeenCalledTimes(1)
  audio.dispose()
})

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
