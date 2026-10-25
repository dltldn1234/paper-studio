export interface FrameTime {
  elapsed: number
  delta: number
}

/** Owns one RAF chain; hidden time never advances the scene timeline. */
export function startRenderLoop(render: (time: FrameTime) => void): () => void {
  let frame: number | undefined
  let previous: number | undefined
  let elapsed = 0
  let disposed = false

  const tick = (timestamp: number) => {
    frame = undefined
    if (disposed || document.hidden) return
    const delta =
      previous === undefined ? 0 : Math.min((timestamp - previous) / 1000, 0.1)
    previous = timestamp
    elapsed += delta
    render({ elapsed, delta })
    if (!disposed) frame = window.requestAnimationFrame(tick)
  }
  const visibilityChanged = () => {
    if (frame !== undefined) window.cancelAnimationFrame(frame)
    frame = undefined
    previous = undefined
    if (!disposed && !document.hidden)
      frame = window.requestAnimationFrame(tick)
  }
  document.addEventListener('visibilitychange', visibilityChanged)
  visibilityChanged()

  return () => {
    if (disposed) return
    disposed = true
    if (frame !== undefined) window.cancelAnimationFrame(frame)
    document.removeEventListener('visibilitychange', visibilityChanged)
  }
}
