export type Point2D = { x: number; y: number }
export type Point3D = { x: number; y: number; z: number }

export type Vector2D = { x: number; y: number }
export type Vector3D = { x: number; y: number; z: number }

export type Polygon = {
  vertices: Point2D[]
}

export type FaceId = 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom'

export type Face = {
  id: FaceId
  label: string
  widthMm: number
  heightMm: number
  center: Point3D
  normal: Vector3D
  vertices: Point3D[]
}

export type Edge = {
  id: string
  start: Point3D
  end: Point3D
  adjacentFaceIds: FaceId[]
}

export type CuboidDimensions = {
  widthMm: number
  depthMm: number
  heightMm: number
}

export type Cuboid = {
  dimensions: CuboidDimensions
  faces: Face[]
  edges: Edge[]
}

export type NetFace = {
  id: FaceId
  label: string
  widthMm: number
  heightMm: number
  origin: Point2D
  polygon: Polygon
  edgeNeighborIds: [FaceId, FaceId, FaceId, FaceId]
}

export type NetEdge = {
  id: string
  hostFaceId: FaceId
  start: Point2D
  end: Point2D
  kind: 'cut' | 'fold'
  adjacentFaceIds: FaceId[]
}

export type NetBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type GlueTab = {
  id: string
  edgeId: string
  faceId: FaceId
  polygon: Polygon
  widthMm: number
  angleDeg: number
}

export type GlueTabOptions = {
  enabled: boolean
  widthMm: number
  angleDeg: number
}

export type GlueTabInterference =
  | { kind: 'tab-tab'; firstTabId: string; secondTabId: string }
  | { kind: 'tab-face'; tabId: string; faceId: FaceId }

export type NetLayout = {
  faces: NetFace[]
  edges: NetEdge[]
  glueTabs: GlueTab[]
  tabInterferences: GlueTabInterference[]
  bounds: NetBounds
}

export type ValidationIssue = {
  field: keyof CuboidDimensions
  message: string
}

export type ValidationResult =
  { valid: true; issues: [] } | { valid: false; issues: ValidationIssue[] }
