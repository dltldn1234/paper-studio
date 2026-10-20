import type {
  Cuboid,
  CuboidDimensions,
  Edge,
  Face,
  FaceId,
  NetEdge,
  NetFace,
  NetLayout,
  Point2D,
  Point3D,
  ValidationResult,
  Vector3D,
} from './types'

export const MIN_DIMENSION_MM = 0.1
export const MAX_DIMENSION_MM = 10_000

const faceLabels: Record<FaceId, string> = {
  front: '앞면',
  right: '오른쪽 면',
  back: '뒷면',
  left: '왼쪽 면',
  top: '윗면',
  bottom: '아랫면',
}

export function validateCuboidDimensions(
  dimensions: CuboidDimensions,
): ValidationResult {
  const issues = (
    Object.keys(dimensions) as (keyof CuboidDimensions)[]
  ).flatMap((field) => {
    const value = dimensions[field]
    if (!Number.isFinite(value)) {
      return [{ field, message: '치수는 유한한 숫자여야 합니다.' }]
    }
    if (value < MIN_DIMENSION_MM) {
      return [
        { field, message: `치수는 ${MIN_DIMENSION_MM} mm 이상이어야 합니다.` },
      ]
    }
    if (value > MAX_DIMENSION_MM) {
      return [
        { field, message: `치수는 ${MAX_DIMENSION_MM} mm 이하여야 합니다.` },
      ]
    }
    return []
  })

  return issues.length === 0
    ? { valid: true, issues: [] }
    : { valid: false, issues }
}

function point3Key(point: Point3D): string {
  return `${point.x},${point.y},${point.z}`
}

function point2Key(point: Point2D): string {
  return `${point.x},${point.y}`
}

function edgeKey(start: string, end: string): string {
  return start < end ? `${start}|${end}` : `${end}|${start}`
}

function createFace(
  id: FaceId,
  widthMm: number,
  heightMm: number,
  center: Point3D,
  normal: Vector3D,
  vertices: Point3D[],
): Face {
  return {
    id,
    label: faceLabels[id],
    widthMm,
    heightMm,
    center,
    normal,
    vertices,
  }
}

function createFaces({
  widthMm: w,
  depthMm: d,
  heightMm: h,
}: CuboidDimensions): Face[] {
  const x = w / 2
  const y = d / 2
  const z = h / 2

  return [
    createFace('front', w, h, { x: 0, y: -y, z: 0 }, { x: 0, y: -1, z: 0 }, [
      { x: -x, y: -y, z: -z },
      { x, y: -y, z: -z },
      { x, y: -y, z },
      { x: -x, y: -y, z },
    ]),
    createFace('right', d, h, { x, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, [
      { x, y: -y, z: -z },
      { x, y, z: -z },
      { x, y, z },
      { x, y: -y, z },
    ]),
    createFace('back', w, h, { x: 0, y, z: 0 }, { x: 0, y: 1, z: 0 }, [
      { x, y, z: -z },
      { x: -x, y, z: -z },
      { x: -x, y, z },
      { x, y, z },
    ]),
    createFace('left', d, h, { x: -x, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, [
      { x: -x, y, z: -z },
      { x: -x, y: -y, z: -z },
      { x: -x, y: -y, z },
      { x: -x, y, z },
    ]),
    createFace('top', w, d, { x: 0, y: 0, z }, { x: 0, y: 0, z: 1 }, [
      { x: -x, y: -y, z },
      { x, y: -y, z },
      { x, y, z },
      { x: -x, y, z },
    ]),
    createFace('bottom', w, d, { x: 0, y: 0, z: -z }, { x: 0, y: 0, z: -1 }, [
      { x: -x, y, z: -z },
      { x, y, z: -z },
      { x, y: -y, z: -z },
      { x: -x, y: -y, z: -z },
    ]),
  ]
}

function createEdges(faces: Face[]): Edge[] {
  const edges = new Map<string, Edge>()

  for (const face of faces) {
    face.vertices.forEach((start, index) => {
      const end = face.vertices[(index + 1) % face.vertices.length]
      const key = edgeKey(point3Key(start), point3Key(end))
      const existing = edges.get(key)
      if (existing) {
        existing.adjacentFaceIds.push(face.id)
      } else {
        edges.set(key, {
          id: `edge-${edges.size + 1}`,
          start,
          end,
          adjacentFaceIds: [face.id],
        })
      }
    })
  }

  return [...edges.values()]
}

export function createCuboid(dimensions: CuboidDimensions): Cuboid {
  const validation = validateCuboidDimensions(dimensions)
  if (!validation.valid) {
    throw new RangeError(
      validation.issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join(' '),
    )
  }

  const faces = createFaces(dimensions)
  return { dimensions: { ...dimensions }, faces, edges: createEdges(faces) }
}

function createNetFaces({
  widthMm: w,
  depthMm: d,
  heightMm: h,
}: CuboidDimensions): NetFace[] {
  const placements: {
    id: FaceId
    x: number
    y: number
    widthMm: number
    heightMm: number
  }[] = [
    { id: 'front', x: d, y: d, widthMm: w, heightMm: h },
    { id: 'right', x: d + w, y: d, widthMm: d, heightMm: h },
    { id: 'back', x: 2 * d + w, y: d, widthMm: w, heightMm: h },
    { id: 'left', x: 0, y: d, widthMm: d, heightMm: h },
    { id: 'top', x: d, y: 0, widthMm: w, heightMm: d },
    { id: 'bottom', x: d, y: d + h, widthMm: w, heightMm: d },
  ]

  return placements.map(({ id, x, y, widthMm, heightMm }) => ({
    id,
    label: faceLabels[id],
    widthMm,
    heightMm,
    origin: { x, y },
    polygon: {
      vertices: [
        { x, y },
        { x: x + widthMm, y },
        { x: x + widthMm, y: y + heightMm },
        { x, y: y + heightMm },
      ],
    },
  }))
}

function createNetEdges(faces: NetFace[]): NetEdge[] {
  const edges = new Map<string, NetEdge>()

  for (const face of faces) {
    face.polygon.vertices.forEach((start, index) => {
      const end =
        face.polygon.vertices[(index + 1) % face.polygon.vertices.length]
      const key = edgeKey(point2Key(start), point2Key(end))
      const existing = edges.get(key)
      if (existing) {
        existing.adjacentFaceIds.push(face.id)
        existing.kind = 'fold'
      } else {
        edges.set(key, {
          id: `net-edge-${edges.size + 1}`,
          start,
          end,
          kind: 'cut',
          adjacentFaceIds: [face.id],
        })
      }
    })
  }

  return [...edges.values()]
}

export function createCuboidNet(dimensions: CuboidDimensions): NetLayout {
  const validation = validateCuboidDimensions(dimensions)
  if (!validation.valid) {
    throw new RangeError(
      validation.issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join(' '),
    )
  }

  const faces = createNetFaces(dimensions)
  const minX = Math.min(...faces.map((face) => face.origin.x))
  const minY = Math.min(...faces.map((face) => face.origin.y))
  const maxX = Math.max(...faces.map((face) => face.origin.x + face.widthMm))
  const maxY = Math.max(...faces.map((face) => face.origin.y + face.heightMm))

  return {
    faces,
    edges: createNetEdges(faces),
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
  }
}
