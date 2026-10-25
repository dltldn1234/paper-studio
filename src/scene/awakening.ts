import { idlePose } from './DinosaurRig'
import { smoothProgress } from './IntroTimeline'

/** A restrained two-second lift, jaw opening and recovery, sampled in intro seconds. */
export function awakeningFrame(seconds: number, reducedMotion = false) {
  const idle = idlePose(Math.max(0, seconds - 7), reducedMotion)
  if (reducedMotion || seconds < 5 || seconds >= 7) {
    return { pose: idle, lightPulse: 0, cameraImpulse: 0 }
  }
  const inhale = smoothProgress(seconds, 5, 5.6)
  const release = 1 - smoothProgress(seconds, 6.42, 7)
  const open =
    smoothProgress(seconds, 5.55, 5.98) *
    (1 - smoothProgress(seconds, 6.4, 6.92))
  const impact =
    smoothProgress(seconds, 5.88, 5.98) *
    (1 - smoothProgress(seconds, 6.08, 6.4))
  const recoil = Math.sin(Math.max(0, seconds - 5.92) * 16) * impact
  const pulse =
    smoothProgress(seconds, 5.9, 5.98) *
    (1 - smoothProgress(seconds, 6.05, 6.45))
  return {
    pose: {
      ...idle,
      headLift: inhale * release * (1 - impact * 0.16),
      jawOpen: open * (1 - Math.max(0, recoil) * 0.035),
      bodyLean: open * 0.65,
      crouch: inhale * (1 - smoothProgress(seconds, 5.7, 6.2)) * 0.8,
      neckRecoil: impact * 0.6 + recoil * 0.12,
      tailSwing: -impact * 0.65,
      tailLift: open * 0.55,
      headYaw: impact * 0.5,
      breath: 0,
    },
    lightPulse: pulse,
    cameraImpulse:
      pulse === 0
        ? 0
        : (Math.sin((seconds - 5.95) * 67) +
            Math.sin((seconds - 5.95) * 113) * 0.35) *
          pulse *
          0.038,
  }
}
