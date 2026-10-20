export {
  createCuboid,
  createCuboidNet,
  MAX_DIMENSION_MM,
  MIN_DIMENSION_MM,
  validateCuboidDimensions,
} from './cuboid'
export {
  analyzePolyhedron,
  calculateFaceNormal,
  POLYHEDRON_EPSILON,
} from './polyhedron'
export type { PolyhedronAnalysis, PolyhedronIssue } from './polyhedron'
export {
  createRegularCube,
  createRegularOctahedron,
  createRegularPolyhedron,
  createRegularTetrahedron,
} from './regular-polyhedra'
export type { RegularPolyhedronKind } from './regular-polyhedra'
export {
  DEFAULT_UNFOLDING_SEARCH_LIMIT,
  UNFOLDING_EPSILON_MM,
  findUnfoldedFaceOverlaps,
  unfoldPolyhedron,
} from './unfolding'
export type {
  UnfoldedEdge,
  UnfoldedFace,
  UnfoldedNet,
  UnfoldingOptions,
  UnfoldingResult,
} from './unfolding'
export {
  add2D,
  add3D,
  cross3D,
  dot2D,
  dot3D,
  length2D,
  length3D,
  normalize2D,
  normalize3D,
  scale3D,
  subtract2D,
  subtract3D,
} from './vectors'
export {
  DEFAULT_GLUE_TAB_OPTIONS,
  findGlueTabInterferences,
  generateGlueTabs,
  MAX_GLUE_TAB_ANGLE_DEG,
  MAX_GLUE_TAB_WIDTH_MM,
  MIN_GLUE_TAB_ANGLE_DEG,
  MIN_GLUE_TAB_WIDTH_MM,
} from './glue-tabs'
export type {
  Cuboid,
  CuboidDimensions,
  Edge,
  Face,
  FaceId,
  GlueTab,
  GlueTabInterference,
  GlueTabOptions,
  NetBounds,
  NetEdge,
  NetFace,
  NetLayout,
  Point2D,
  Point3D,
  PolyhedronEdge,
  PolyhedronFace,
  PolyhedronMesh,
  PolyhedronVertex,
  Polygon,
  ValidationIssue,
  ValidationResult,
  Vector2D,
  Vector3D,
} from './types'
