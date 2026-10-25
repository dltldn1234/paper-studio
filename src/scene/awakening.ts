import { idlePose } from './DinosaurRig'
import { smoothProgress } from './IntroTimeline'

/** A restrained two-second lift, jaw opening and recovery, sampled in intro seconds. */
export function awakeningFrame(seconds: number, reducedMotion = false) {
  const idle = idlePose(Math.max(0, seconds - 7), reducedMotion)
  if (reducedMotion || seconds < 5 || seconds >= 7) {
    return { pose: idle, lightPulse: 0, cameraImpulse: 0 }
  }
  const lift =
    smoothProgress(seconds, 5, 5.65) * (1 - smoothProgress(seconds, 6.35, 7))
  const open =
    smoothProgress(seconds, 5.55, 6.05) *
    (1 - smoothProgress(seconds, 6.2, 6.85))
  const pulse =
    smoothProgress(seconds, 5.95, 6.02) *
    (1 - smoothProgress(seconds, 6.02, 6.2))
  return {
    pose: {
      ...idle,
      headLift: lift,
      jawOpen: open,
      bodyLean: -open,
      tailSwing: open * 0.4,
      breath: 0,
    },
    lightPulse: pulse,
    cameraImpulse: Math.sin((seconds - 6) * 110) * pulse * 0.012,
  }
}
