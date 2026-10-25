import { type Group, type Quaternion, type Vector3 } from 'three'
import type { PaperDinosaur } from './PaperDinosaur'

export interface DinosaurPose {
  headLift: number
  jawOpen: number
  bodyLean: number
  tailSwing: number
  breath: number
}

const REST: DinosaurPose = {
  headLift: 0,
  jawOpen: 0,
  bodyLean: 0,
  tailSwing: 0,
  breath: 0,
}

/** Absolute poses restore bind transforms first, so replay never accumulates drift. */
export class DinosaurRig {
  private readonly bind: {
    joint: Group
    position: Vector3
    quaternion: Quaternion
  }[]

  constructor(private readonly model: PaperDinosaur) {
    this.bind = [
      model.body,
      model.neck,
      model.head,
      model.jaw,
      model.tail,
      ...model.arms,
      ...model.legs,
    ].map((joint) => ({
      joint,
      position: joint.position.clone(),
      quaternion: joint.quaternion.clone(),
    }))
  }

  apply(input: Partial<DinosaurPose> = {}): void {
    const pose = { ...REST, ...input }
    this.reset()
    this.model.neck.rotation.z += pose.headLift * 0.16
    this.model.head.rotation.z += pose.headLift * 0.12
    this.model.jaw.rotation.z -= Math.max(0, Math.min(1, pose.jawOpen)) * 0.42
    this.model.body.rotation.z += pose.bodyLean * 0.025
    this.model.body.position.y += pose.breath * 0.012
    this.model.tail.rotation.y += pose.tailSwing * 0.025
    this.model.arms.forEach((arm, index) => {
      arm.rotation.x += pose.breath * (index === 0 ? -0.015 : 0.015)
    })
    this.model.root.updateMatrixWorld(true)
  }

  reset(): void {
    for (const { joint, position, quaternion } of this.bind) {
      joint.position.copy(position)
      joint.quaternion.copy(quaternion)
    }
  }
}

export function idlePose(seconds: number, reducedMotion = false): DinosaurPose {
  if (reducedMotion) return { ...REST }
  return {
    ...REST,
    breath: Math.sin(seconds * 1.2),
    tailSwing: Math.sin(seconds * 0.48),
    headLift: Math.sin(seconds * 0.38) * 0.035,
  }
}
