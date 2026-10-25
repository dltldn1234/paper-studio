import { smoothProgress } from './IntroTimeline'

export function cinematicCamera(
  seconds: number,
  aspect: number,
  idleSeconds = 0,
  reducedMotion = false,
) {
  const mobile = aspect < 0.9
  const distance = mobile ? 18 : 13.3
  if (reducedMotion) return { x: 4, y: 4.5, z: distance, targetY: 2.1 }
  const rise = smoothProgress(seconds, 1.4, 5)
  const approach =
    smoothProgress(seconds, 4.4, 5.6) * (1 - smoothProgress(seconds, 6.8, 9))
  return {
    x: 4 + Math.sin(idleSeconds * 0.12) * 0.12,
    y: 7.2 - rise * 2.7 - approach * 0.15,
    z: distance + (1 - rise) * 1.1 - approach * 1.3,
    targetY: 0.8 + rise * 1.3,
  }
}
