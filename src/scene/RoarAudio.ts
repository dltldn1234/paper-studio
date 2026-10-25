/** Original synthesized paper-creature rumble; the context is created only by a gesture. */
export class RoarAudio {
  private context: AudioContext | null = null
  private active: AudioScheduledSourceNode[] = []
  enabled = false

  async toggle(): Promise<boolean> {
    if (this.enabled) {
      this.enabled = false
      this.stop()
      return false
    }
    if (typeof AudioContext === 'undefined') return false
    try {
      this.context ??= new AudioContext()
      await this.context.resume()
      this.enabled = this.context.state === 'running'
    } catch {
      this.enabled = false
    }
    return this.enabled
  }

  play(): void {
    const context = this.context
    if (!this.enabled || !context || context.state !== 'running') return
    this.stop()
    const time = context.currentTime
    const envelope = context.createGain()
    envelope.gain.setValueAtTime(0.0001, time)
    envelope.gain.exponentialRampToValueAtTime(0.12, time + 0.08)
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.7)
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(650, time)
    filter.frequency.exponentialRampToValueAtTime(120, time + 0.7)
    const voice = context.createOscillator()
    voice.type = 'sawtooth'
    voice.frequency.setValueAtTime(82, time)
    voice.frequency.exponentialRampToValueAtTime(38, time + 0.7)
    voice.connect(filter)
    filter.connect(envelope)
    envelope.connect(context.destination)
    voice.onended = () => {
      voice.disconnect()
      filter.disconnect()
      envelope.disconnect()
      this.active = this.active.filter((node) => node !== voice)
    }
    this.active.push(voice)
    voice.start(time)
    voice.stop(time + 0.75)
  }

  stop(): void {
    for (const source of this.active) {
      try {
        source.stop()
      } catch {
        /* Already ended. */
      }
    }
    this.active = []
  }

  dispose(): void {
    this.enabled = false
    this.stop()
    void this.context?.close()
    this.context = null
  }
}
