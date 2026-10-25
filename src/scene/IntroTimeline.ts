export const INTRO_DURATION = 9
export type IntroPhase =
  'blueprint' | 'construction' | 'awakening' | 'reveal' | 'idle'
export type PlaybackState = 'playing' | 'paused' | 'complete'

export function smoothProgress(
  time: number,
  start: number,
  end: number,
): number {
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function introFrame(time: number) {
  const seconds = Math.max(0, Math.min(INTRO_DURATION, time))
  const phase: IntroPhase =
    seconds < 2
      ? 'blueprint'
      : seconds < 5
        ? 'construction'
        : seconds < 7
          ? 'awakening'
          : seconds < 9
            ? 'reveal'
            : 'idle'
  return {
    seconds,
    phase,
    blueprint: smoothProgress(seconds, 0, 2),
    construction: smoothProgress(seconds, 2, 5),
    awakening: smoothProgress(seconds, 5, 7),
    reveal: smoothProgress(seconds, 7, 9),
  }
}

/** Clock-free deterministic playback: advance from the visibility-aware render loop. */
export class IntroTimeline {
  private position = 0
  private playback: PlaybackState = 'playing'

  constructor(reducedMotion = false) {
    if (reducedMotion) this.skip()
  }

  get state(): PlaybackState {
    return this.playback
  }
  get frame() {
    return introFrame(this.position)
  }

  advance(delta: number) {
    if (this.playback === 'playing' && Number.isFinite(delta) && delta > 0) {
      this.seek(this.position + delta)
    }
    return this.frame
  }

  seek(seconds: number): void {
    if (!Number.isFinite(seconds)) return
    this.position = Math.max(0, Math.min(INTRO_DURATION, seconds))
    if (this.position === INTRO_DURATION) this.playback = 'complete'
    else if (this.playback === 'complete') this.playback = 'paused'
  }

  pause(): void {
    if (this.playback === 'playing') this.playback = 'paused'
  }

  resume(): void {
    if (this.playback === 'paused') this.playback = 'playing'
  }

  skip(): void {
    this.seek(INTRO_DURATION)
  }

  replay(reducedMotion = false): void {
    this.position = reducedMotion ? INTRO_DURATION : 0
    this.playback = reducedMotion ? 'complete' : 'playing'
  }
}
