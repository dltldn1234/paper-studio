/** Original synthesized paper-creature rumble; the context is created only by a gesture. */
export class RoarAudio {
  private context: AudioContext | null = null
  private active: AudioScheduledSourceNode[] = []
  private release: (() => void) | null = null
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
    const duration = 1.35
    const master = context.createGain()
    master.gain.setValueAtTime(0.0001, time)
    master.gain.exponentialRampToValueAtTime(0.23, time + 0.085)
    master.gain.exponentialRampToValueAtTime(0.16, time + 0.52)
    master.gain.exponentialRampToValueAtTime(0.0001, time + duration)
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 5
    compressor.attack.value = 0.004
    compressor.release.value = 0.16
    master.connect(compressor)
    compressor.connect(context.destination)
    const throat = context.createBiquadFilter()
    throat.type = 'lowpass'
    throat.frequency.setValueAtTime(1400, time)
    throat.frequency.exponentialRampToValueAtTime(220, time + duration)
    throat.Q.value = 0.7
    throat.connect(master)
    const voice = context.createOscillator()
    voice.type = 'sawtooth'
    voice.frequency.setValueAtTime(104, time)
    voice.frequency.exponentialRampToValueAtTime(63, time + 0.45)
    voice.frequency.exponentialRampToValueAtTime(39, time + duration)
    const voiceGain = context.createGain()
    voiceGain.gain.value = 0.34
    const formant = context.createBiquadFilter()
    formant.type = 'peaking'
    formant.frequency.value = 430
    formant.Q.value = 1.4
    formant.gain.value = 8
    voice.connect(voiceGain)
    voiceGain.connect(formant)
    formant.connect(throat)
    const bass = context.createOscillator()
    bass.type = 'sine'
    bass.frequency.setValueAtTime(47, time)
    bass.frequency.exponentialRampToValueAtTime(31, time + duration)
    const bassGain = context.createGain()
    bassGain.gain.value = 0.75
    bass.connect(bassGain)
    bassGain.connect(master)
    const modulation = context.createOscillator()
    modulation.frequency.value = 28
    const modulationDepth = context.createGain()
    modulationDepth.gain.value = 0.11
    modulation.connect(modulationDepth)
    modulationDepth.connect(voiceGain.gain)
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    )
    const samples = buffer.getChannelData(0)
    let seed = 17431,
      colored = 0
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      colored = colored * 0.78 + (seed / 2147483648 - 1) * 0.22
      samples[i] = colored * 1.3
    }
    const breath = context.createBufferSource()
    breath.buffer = buffer
    const breathFilter = context.createBiquadFilter()
    breathFilter.type = 'bandpass'
    breathFilter.frequency.setValueAtTime(850, time)
    breathFilter.frequency.exponentialRampToValueAtTime(280, time + duration)
    breathFilter.Q.value = 0.55
    breath.connect(breathFilter)
    breathFilter.connect(throat)
    const sources = [voice, bass, modulation, breath]
    const owned: AudioNode[] = [
      master,
      compressor,
      throat,
      voice,
      voiceGain,
      formant,
      bass,
      bassGain,
      modulation,
      modulationDepth,
      breath,
      breathFilter,
    ]
    let released = false
    const release = () => {
      if (released) return
      released = true
      owned.forEach((node) => node.disconnect())
      if (this.release === release) this.release = null
    }
    this.release = release
    const remaining = new Set<AudioScheduledSourceNode>(sources)
    for (const source of sources) {
      source.onended = () => {
        remaining.delete(source)
        this.active = this.active.filter((node) => node !== source)
        if (remaining.size === 0) release()
      }
      source.start(time)
      source.stop(time + duration + 0.02)
    }
    this.active = sources
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
    this.release?.()
    this.release = null
  }

  dispose(): void {
    this.enabled = false
    this.stop()
    void this.context?.close()
    this.context = null
  }
}
