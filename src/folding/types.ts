/** UI-independent primitives used by the folding solver. Distances are millimetres. */
export type FoldPoint = { x: number; y: number; z: number }
export type Quaternion = { x: number; y: number; z: number; w: number }
export type RigidTransform = { rotation: Quaternion; translation: FoldPoint }

export type FoldFaceNode = {
  id: string
  center: FoldPoint
}

export type FoldHinge = {
  id: string
  parentFaceId: string
  childFaceId: string
  /** Hinge endpoints in the unfolded net's shared coordinate system. */
  start: FoldPoint
  end: FoldPoint
  /** Signed final rotation derived by the net adapter from target face frames. */
  angleRadians: number
}

export type FoldGraph = {
  rootFaceId: string
  faces: FoldFaceNode[]
  hinges: FoldHinge[]
}

export type FoldPose = {
  faceId: string
  transform: RigidTransform
}

export type FoldGraphError =
  | { kind: 'missing-root'; faceId: string }
  | { kind: 'duplicate-face'; faceId: string }
  | { kind: 'invalid-face'; faceId: string; reason: string }
  | { kind: 'invalid-hinge'; hingeId: string; reason: string }
  | { kind: 'disconnected'; faceIds: string[] }
