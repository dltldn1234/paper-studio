export type SceneQuality = 'high' | 'low'

/** Downgrade only after sustained slow frames; never oscillate during an intro. */
export class DeviceQuality {
  private samples = 0
  private seconds = 0
  quality: SceneQuality

  constructor(concurrency: number, mobile: boolean, saveData = false) {
    this.quality = saveData || mobile || concurrency <= 4 ? 'low' : 'high'
  }

  observe(delta: number): boolean {
    if (this.quality === 'low' || !Number.isFinite(delta) || delta <= 0)
      return false
    this.samples++
    this.seconds += delta
    if (this.samples < 90) return false
    const slow = this.seconds / this.samples > 1 / 42
    this.samples = 0
    this.seconds = 0
    if (slow) this.quality = 'low'
    return slow
  }
}
