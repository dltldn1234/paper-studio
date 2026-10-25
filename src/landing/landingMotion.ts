import {
  MOTION_PREFERENCES_EVENT,
  readMotionPreferences,
} from '../persistence/motion-preferences'

export const LANDING_PAUSE_EVENT = 'paper-studio:landing-pause'

/** Owns input-driven DOM motion; no continuous RAF or React frame updates. */
export function mountLandingMotion(root: HTMLElement) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  let reduced = readMotionPreferences().reduce ?? media.matches
  let paused = false
  let disposed = false
  let frame: number | null = null
  let pointer: { x: number; y: number; target: HTMLElement } | null = null
  let tilted: HTMLElement | null = null
  const targets = Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-motion-reveal], [data-motion-track]',
    ),
  )
  const resetTilt = () => {
    if (tilted) {
      for (const name of [
        '--tilt-x',
        '--tilt-y',
        '--magnet-x',
        '--magnet-y',
        '--pointer-x',
        '--pointer-y',
      ])
        tilted.style.removeProperty(name)
    }
    tilted = null
  }
  const updateState = () => {
    root.dataset.pageMotion = document.hidden
      ? 'hidden'
      : reduced
        ? 'reduced'
        : paused
          ? 'paused'
          : 'active'
    if (reduced)
      targets.forEach((target) => {
        target.dataset.revealed = 'true'
      })
    if (reduced || paused || document.hidden) {
      pointer = null
      resetTilt()
    }
  }
  const update = () => {
    frame = null
    if (disposed || document.hidden) return
    const range = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight,
    )
    root.style.setProperty(
      '--page-progress',
      String(Math.max(0, Math.min(1, window.scrollY / range))),
    )
    if (pointer && !reduced && !paused && finePointer.matches) {
      const { target, x, y } = pointer
      if (tilted !== target) {
        resetTilt()
        tilted = target
      }
      const bounds = target.getBoundingClientRect()
      const nx = Math.max(
        -0.5,
        Math.min(0.5, (x - bounds.left) / Math.max(1, bounds.width) - 0.5),
      )
      const ny = Math.max(
        -0.5,
        Math.min(0.5, (y - bounds.top) / Math.max(1, bounds.height) - 0.5),
      )
      if (target.hasAttribute('data-motion-depth')) {
        target.style.setProperty('--tilt-x', `${-ny * 5}deg`)
        target.style.setProperty('--tilt-y', `${nx * 6}deg`)
      } else {
        target.style.setProperty('--magnet-x', `${nx * 5}px`)
        target.style.setProperty('--magnet-y', `${ny * 5}px`)
      }
      target.style.setProperty('--pointer-x', `${(nx + 0.5) * 100}%`)
      target.style.setProperty('--pointer-y', `${(ny + 0.5) * 100}%`)
    }
  }
  const schedule = () => {
    if (!disposed && !document.hidden && frame === null)
      frame = window.requestAnimationFrame(update)
  }
  const onPointer = (event: PointerEvent) => {
    if (
      reduced ||
      paused ||
      !finePointer.matches ||
      event.pointerType === 'touch'
    )
      return
    const target =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(
            '[data-motion-depth], [data-motion-magnet]',
          )
        : null
    if (!target || !root.contains(target)) {
      pointer = null
      resetTilt()
      return
    }
    pointer = { x: event.clientX, y: event.clientY, target }
    schedule()
  }
  const onLeave = () => {
    pointer = null
    resetTilt()
  }
  const onFocus = (event: FocusEvent) => {
    onLeave()
    for (
      let target = event.target instanceof HTMLElement ? event.target : null;
      target && root.contains(target);
      target = target.parentElement
    ) {
      if (target.hasAttribute('data-motion-reveal'))
        target.dataset.revealed = 'true'
    }
  }
  const onVisibility = () => {
    updateState()
    if (document.hidden && frame !== null) {
      window.cancelAnimationFrame(frame)
      frame = null
    } else schedule()
  }
  const onPreference = (event: Event) => {
    const value = (event as CustomEvent<{ reduce?: boolean }>).detail?.reduce
    reduced =
      typeof value === 'boolean'
        ? value
        : (readMotionPreferences().reduce ?? media.matches)
    updateState()
  }
  const onPauseRequest = (event: Event) => {
    const value = (event as CustomEvent<{ paused?: boolean }>).detail?.paused
    if (typeof value === 'boolean') {
      paused = value
      updateState()
    }
  }
  const onMedia = () => {
    reduced = media.matches
    updateState()
  }
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          (entries) => {
            if (disposed) return
            for (const entry of entries) {
              ;(entry.target as HTMLElement).dataset.motionVisible = String(
                entry.isIntersecting,
              )
              if (entry.isIntersecting) {
                ;(entry.target as HTMLElement).dataset.revealed = 'true'
              }
            }
          },
          { threshold: 0.14, rootMargin: '0px 0px -32px 0px' },
        )
  for (const target of targets) {
    if (observer) observer.observe(target)
    else {
      target.dataset.revealed = 'true'
      target.dataset.motionVisible = 'true'
    }
    if (reduced) target.dataset.revealed = 'true'
  }
  root.dataset.reveals = 'ready'
  root.addEventListener('pointermove', onPointer, { passive: true })
  root.addEventListener('pointerleave', onLeave)
  root.addEventListener('focusin', onFocus)
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  window.addEventListener(MOTION_PREFERENCES_EVENT, onPreference)
  window.addEventListener(LANDING_PAUSE_EVENT, onPauseRequest)
  document.addEventListener('visibilitychange', onVisibility)
  const watchMedia = (query: MediaQueryList, listener: () => void) => {
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', listener)
      return () => query.removeEventListener('change', listener)
    }
    query.addListener?.(listener)
    return () => query.removeListener?.(listener)
  }
  const stopMotionMedia = watchMedia(media, onMedia)
  const stopPointerMedia = watchMedia(finePointer, onLeave)
  updateState()
  schedule()
  return {
    setPaused(value: boolean) {
      paused = value
      updateState()
    },
    dispose() {
      disposed = true
      if (frame !== null) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      resetTilt()
      root.removeEventListener('pointermove', onPointer)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('focusin', onFocus)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener(MOTION_PREFERENCES_EVENT, onPreference)
      window.removeEventListener(LANDING_PAUSE_EVENT, onPauseRequest)
      document.removeEventListener('visibilitychange', onVisibility)
      stopMotionMedia()
      stopPointerMedia()
      delete root.dataset.pageMotion
      delete root.dataset.reveals
    },
  }
}
