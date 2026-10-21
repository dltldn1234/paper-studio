import type {
  GlueTab,
  GlueTabInterference,
  GlueTabOptions,
  Point2D,
} from './types'

type GlueTabEdgeInput = {
  id: string
  hostFaceId: string
  start: Point2D
  end: Point2D
  kind: 'cut' | 'fold'
  adjacentFaceIds: string[]
}
type GlueTabFaceInput = { id: string; polygon: { vertices: Point2D[] } }

export const DEFAULT_GLUE_TAB_OPTIONS: GlueTabOptions = {
  enabled: false,
  widthMm: 10,
  angleDeg: 45,
}

export const MIN_GLUE_TAB_WIDTH_MM = 0.1
export const MAX_GLUE_TAB_WIDTH_MM = 50
export const MIN_GLUE_TAB_ANGLE_DEG = 15
export const MAX_GLUE_TAB_ANGLE_DEG = 75

function validateOptions({ widthMm, angleDeg }: GlueTabOptions): void {
  if (
    !Number.isFinite(widthMm) ||
    widthMm < MIN_GLUE_TAB_WIDTH_MM ||
    widthMm > MAX_GLUE_TAB_WIDTH_MM
  ) {
    throw new RangeError(
      `Glue tab width must be between ${MIN_GLUE_TAB_WIDTH_MM} and ${MAX_GLUE_TAB_WIDTH_MM} mm.`,
    )
  }
  if (
    !Number.isFinite(angleDeg) ||
    angleDeg < MIN_GLUE_TAB_ANGLE_DEG ||
    angleDeg > MAX_GLUE_TAB_ANGLE_DEG
  ) {
    throw new RangeError(
      `Glue tab angle must be between ${MIN_GLUE_TAB_ANGLE_DEG} and ${MAX_GLUE_TAB_ANGLE_DEG} degrees.`,
    )
  }
}

function createTab(
  edge: GlueTabEdgeInput,
  options: GlueTabOptions,
): GlueTab | null {
  if (edge.adjacentFaceIds.length !== 2) return null

  const dx = edge.end.x - edge.start.x
  const dy = edge.end.y - edge.start.y
  const length = Math.hypot(dx, dy)
  if (length <= 0) return null

  // All net face polygons use the same winding. The right-hand normal points
  // away from the face boundary, so the tab extends into the cut area.
  const direction = { x: dx / length, y: dy / length }
  const outward = { x: direction.y, y: -direction.x }
  const bevelRun = Math.min(
    options.widthMm / Math.tan((options.angleDeg * Math.PI) / 180),
    length * 0.2,
  )
  const outerStart: Point2D = {
    x: edge.start.x + direction.x * bevelRun + outward.x * options.widthMm,
    y: edge.start.y + direction.y * bevelRun + outward.y * options.widthMm,
  }
  const outerEnd: Point2D = {
    x: edge.end.x - direction.x * bevelRun + outward.x * options.widthMm,
    y: edge.end.y - direction.y * bevelRun + outward.y * options.widthMm,
  }

  return {
    id: `tab-${edge.id}`,
    edgeId: edge.id,
    faceId: edge.hostFaceId,
    widthMm: options.widthMm,
    angleDeg: options.angleDeg,
    polygon: {
      vertices: [edge.start, edge.end, outerEnd, outerStart],
    },
  }
}

function polygonsOverlap(first: Point2D[], second: Point2D[]): boolean {
  const polygons = [first, second]
  return polygons.every((polygon) => {
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]
      const end = polygon[(index + 1) % polygon.length]
      const axis = { x: -(end.y - start.y), y: end.x - start.x }
      const firstProjection = first.map(
        (point) => point.x * axis.x + point.y * axis.y,
      )
      const secondProjection = second.map(
        (point) => point.x * axis.x + point.y * axis.y,
      )
      const overlap =
        Math.min(Math.max(...firstProjection), Math.max(...secondProjection)) -
        Math.max(Math.min(...firstProjection), Math.min(...secondProjection))
      if (overlap <= 1e-7) return false
    }
    return true
  })
}

export function findGlueTabInterferences(
  tabs: GlueTab[],
  faces: GlueTabFaceInput[] = [],
): GlueTabInterference[] {
  const interferences: GlueTabInterference[] = []
  for (let firstIndex = 0; firstIndex < tabs.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < tabs.length;
      secondIndex += 1
    ) {
      const first = tabs[firstIndex]
      const second = tabs[secondIndex]
      if (polygonsOverlap(first.polygon.vertices, second.polygon.vertices)) {
        interferences.push({
          kind: 'tab-tab',
          firstTabId: first.id,
          secondTabId: second.id,
        })
      }
    }
  }
  for (const tab of tabs) {
    for (const face of faces) {
      if (
        face.id !== tab.faceId &&
        polygonsOverlap(tab.polygon.vertices, face.polygon.vertices)
      ) {
        interferences.push({ kind: 'tab-face', tabId: tab.id, faceId: face.id })
      }
    }
  }
  return interferences
}

export function generateGlueTabs(
  edges: GlueTabEdgeInput[],
  options: GlueTabOptions = DEFAULT_GLUE_TAB_OPTIONS,
  faces: GlueTabFaceInput[] = [],
): { tabs: GlueTab[]; interferences: GlueTabInterference[] } {
  validateOptions(options)
  if (!options.enabled) return { tabs: [], interferences: [] }

  const joinedFaces = new Set<string>()
  const tabs = edges
    .filter((edge) => {
      if (edge.kind !== 'cut' || edge.adjacentFaceIds.length !== 2) return false
      const key = [...edge.adjacentFaceIds].sort().join('|')
      if (joinedFaces.has(key)) return false
      joinedFaces.add(key)
      return true
    })
    .map((edge) => createTab(edge, options))
    .filter((tab): tab is GlueTab => tab !== null)
  return { tabs, interferences: findGlueTabInterferences(tabs, faces) }
}
