import { findUnfoldedFaceOverlaps } from '../geometry'
import type { PolyhedronMesh } from '../geometry'
import type { UnfoldedNet } from '../geometry/unfolding'
import {
  COLLISION_EPSILON_MM,
  detectPolyhedronFaceIntersections,
} from './collisions'
import type { FaceIntersection } from './collisions'
import type { FoldPose } from './types'

/** Describes the material model used when reporting geometric contacts. */
export type CollisionModel =
  | { kind: 'ideal-surfaces'; thicknessMm: 0 }
  | { kind: 'paper-thickness'; thicknessMm: number }

export type NetOverlapDiagnostic = {
  domain: 'net-2d'
  firstFaceId: string
  secondFaceId: string
}

export type FoldedIntersectionDiagnostic = FaceIntersection & {
  domain: 'folded-3d'
}

/** UI-independent contract for flat-net and folded-surface collision checks. */
export interface CollisionDiagnosticsEngine<
  Model extends CollisionModel = CollisionModel,
> {
  readonly model: Model
  inspectNet(net: UnfoldedNet): NetOverlapDiagnostic[]
  inspectFolded(
    mesh: PolyhedronMesh,
    net: UnfoldedNet,
    poses: FoldPose[],
  ): FoldedIntersectionDiagnostic[]
}

/** Current zero-thickness implementation; material thickness is not simulated. */
export function createIdealSurfaceCollisionEngine(
  toleranceMm = COLLISION_EPSILON_MM,
): CollisionDiagnosticsEngine<{ kind: 'ideal-surfaces'; thicknessMm: 0 }> {
  if (!Number.isFinite(toleranceMm) || toleranceMm <= 0) {
    throw new RangeError(
      'Collision tolerance must be a finite positive number.',
    )
  }
  const model = { kind: 'ideal-surfaces', thicknessMm: 0 } as const
  return {
    model,
    inspectNet(net) {
      return findUnfoldedFaceOverlaps(net.faces, toleranceMm).map(
        (overlap) => ({
          domain: 'net-2d',
          ...overlap,
        }),
      )
    },
    inspectFolded(mesh, net, poses) {
      return detectPolyhedronFaceIntersections(
        mesh,
        net,
        poses,
        toleranceMm,
      ).map((intersection) => ({ domain: 'folded-3d', ...intersection }))
    },
  }
}
