import { describe, expect, it } from 'vitest'
import { IntroTimeline, introFrame, smoothProgress } from './IntroTimeline'

describe('cinematic timeline', () => {
  it.each([
    [0, 'blueprint'],
    [2, 'construction'],
    [5, 'awakening'],
    [7, 'reveal'],
    [9, 'idle'],
  ] as const)('stages %s seconds as %s', (time, phase) => {
    expect(introFrame(time).phase).toBe(phase)
    expect(introFrame(time)).toEqual(introFrame(time))
  })

  it('pauses without consuming elapsed time and resumes to completion', () => {
    const timeline = new IntroTimeline()
    timeline.advance(3)
    timeline.pause()
    timeline.advance(50)
    expect(timeline.frame.seconds).toBe(3)
    timeline.resume()
    timeline.advance(3)
    expect(timeline.frame.phase).toBe('awakening')
    timeline.advance(20)
    expect(timeline.state).toBe('complete')
    expect(timeline.frame.seconds).toBe(9)
  })

  it('supports skip, replay, seek and static reduced-motion playback', () => {
    const timeline = new IntroTimeline()
    timeline.skip()
    timeline.replay()
    expect(timeline.state).toBe('playing')
    expect(timeline.frame.seconds).toBe(0)
    timeline.seek(6)
    expect(timeline.frame.phase).toBe('awakening')
    timeline.replay(true)
    expect(timeline.state).toBe('complete')
    expect(new IntroTimeline(true).frame.phase).toBe('idle')
  })

  it('rejects invalid deltas and clamps backward seeks', () => {
    const timeline = new IntroTimeline()
    for (const delta of [NaN, Infinity, -1]) timeline.advance(delta)
    timeline.seek(NaN)
    expect(timeline.frame.seconds).toBe(0)
    timeline.seek(-10)
    expect(timeline.frame.seconds).toBe(0)
    expect(smoothProgress(0, 0, 1)).toBe(0)
    expect(smoothProgress(0.5, 0, 1)).toBe(0.5)
    expect(smoothProgress(1, 0, 1)).toBe(1)
  })
})
