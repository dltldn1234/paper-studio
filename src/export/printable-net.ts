import { generateGlueTabs } from '../geometry'
import type {
  GlueTab,
  GlueTabInterference,
  GlueTabOptions,
  NetBounds,
  NetLayout,
  Point2D,
  UnfoldedNet,
} from '../geometry'

export type PrintableFace = {
  id: string
  label: string
  polygon: Point2D[]
}

export type PrintableEdge = {
  id: string
  kind: 'cut' | 'fold'
  start: Point2D
  end: Point2D
}

/** A framework-independent, millimetre-based view used by PDF and print preview. */
export type PrintableNet = {
  bounds: NetBounds
  faces: PrintableFace[]
  edges: PrintableEdge[]
  glueTabs: GlueTab[]
  tabInterferences: GlueTabInterference[]
}

function facePolygon(
  face: NetLayout['faces'][number] | UnfoldedNet['faces'][number],
) {
  return Array.isArray(face.polygon) ? face.polygon : face.polygon.vertices
}

function orientToFaceBoundary(
  edge: UnfoldedNet['edges'][number],
  face: UnfoldedNet['faces'][number],
) {
  const [firstVertexId, secondVertexId] = edge.vertexIds
  const startIndex = face.vertexIds.findIndex(
    (vertexId, index) =>
      vertexId === firstVertexId &&
      face.vertexIds[(index + 1) % face.vertexIds.length] === secondVertexId,
  )
  const reverseIndex = face.vertexIds.findIndex(
    (vertexId, index) =>
      vertexId === secondVertexId &&
      face.vertexIds[(index + 1) % face.vertexIds.length] === firstVertexId,
  )
  if (startIndex >= 0) {
    return {
      start: edge.start,
      end: edge.end,
    }
  }
  if (reverseIndex >= 0) {
    return {
      start: edge.end,
      end: edge.start,
    }
  }
  throw new RangeError(`Edge ${edge.id} is not part of face ${face.id}.`)
}

function includeBounds(points: Point2D[]): NetBounds {
  if (!points.length) throw new RangeError('Printable net has no geometry.')
  const xs = points.map(({ x }) => x)
  const ys = points.map(({ y }) => y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  }
}

/** Scales every printable element in one shared global coordinate system. */
export function scalePrintableNet(
  net: PrintableNet,
  xScale: number,
  yScale: number,
): PrintableNet {
  if (
    !Number.isFinite(xScale) ||
    !Number.isFinite(yScale) ||
    xScale < 0.5 ||
    xScale > 2 ||
    yScale < 0.5 ||
    yScale > 2
  ) {
    throw new RangeError('Print correction scales must be between 0.5 and 2.')
  }
  const centerX = net.bounds.x + net.bounds.width / 2
  const centerY = net.bounds.y + net.bounds.height / 2
  const transform = ({ x, y }: Point2D): Point2D => ({
    x: centerX + (x - centerX) * xScale,
    y: centerY + (y - centerY) * yScale,
  })
  const faces = net.faces.map((face) => ({
    ...face,
    polygon: face.polygon.map(transform),
  }))
  const edges = net.edges.map((edge) => ({
    ...edge,
    start: transform(edge.start),
    end: transform(edge.end),
  }))
  const glueTabs = net.glueTabs.map((tab) => ({
    ...tab,
    polygon: { vertices: tab.polygon.vertices.map(transform) },
  }))
  const allPoints = [
    ...faces.flatMap(({ polygon }) => polygon),
    ...edges.flatMap(({ start, end }) => [start, end]),
    ...glueTabs.flatMap(({ polygon }) => polygon.vertices),
  ]
  return {
    ...net,
    bounds: includeBounds(allPoints),
    faces,
    edges,
    glueTabs,
  }
}

/** Adapts cuboid or polyhedron geometry to a common printable model. */
export function createPrintableNet(
  source: NetLayout | UnfoldedNet,
  glueTabOptions?: GlueTabOptions,
): PrintableNet {
  const isCuboidNet = 'glueTabs' in source
  const faces: PrintableFace[] = source.faces.map((face) => ({
    id: face.id,
    label: face.label,
    polygon: facePolygon(face),
  }))
  const edges: PrintableEdge[] = source.edges.map((edge) => ({
    id: edge.id,
    kind: edge.kind,
    start: edge.start,
    end: edge.end,
  }))

  let glueTabs: GlueTab[]
  let tabInterferences: GlueTabInterference[]
  if (isCuboidNet) {
    glueTabs = source.glueTabs
    tabInterferences = source.tabInterferences
  } else {
    const faceMap = new Map(source.faces.map((face) => [face.id, face]))
    const tabEdges = source.edges.map((edge) => {
      const hostFaceId = edge.adjacentFaceIds[0]
      const hostFace = faceMap.get(hostFaceId)
      if (!hostFace) throw new RangeError(`Missing host face ${hostFaceId}.`)
      const boundary = orientToFaceBoundary(edge, hostFace)
      return {
        id: edge.id,
        hostFaceId,
        ...boundary,
        kind: edge.kind,
        adjacentFaceIds: edge.adjacentFaceIds,
      }
    })
    const result = generateGlueTabs(
      tabEdges,
      glueTabOptions,
      faces.map(({ id, polygon }) => ({ id, polygon: { vertices: polygon } })),
    )
    glueTabs = result.tabs
    tabInterferences = result.interferences
  }

  const allPoints = [
    ...faces.flatMap(({ polygon }) => polygon),
    ...edges.flatMap(({ start, end }) => [start, end]),
    ...glueTabs.flatMap(({ polygon }) => polygon.vertices),
  ]
  return {
    bounds: includeBounds(allPoints),
    faces,
    edges,
    glueTabs,
    tabInterferences,
  }
}
