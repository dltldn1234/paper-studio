import { describe, expect, it } from 'vitest'
import {
  createRegularCube,
  createRegularOctahedron,
  createRegularTetrahedron,
  unfoldPolyhedron,
} from '../geometry'
import type { PolyhedronMesh } from '../geometry'
import { createPolyhedronFoldGraph } from './polyhedron-adapter'
import { solveFoldPoses, transformPoint } from './index'

const solids = [
  { name: 'tetrahedron', create: createRegularTetrahedron },
  { name: 'cube', create: createRegularCube },
  { name: 'octahedron', create: createRegularOctahedron },
] as const

function faceCenter(face: { polygon: Array<{ x: number; y: number }> }) {
  const sum = face.polygon.reduce(
    (center, point) => ({ x: center.x + point.x, y: center.y + point.y }),
    { x: 0, y: 0 },
  )
  return { x: sum.x / face.polygon.length, y: sum.y / face.polygon.length }
}

function modelDistances(mesh: PolyhedronMesh) {
  const result = new Map<string, number>()
  for (let first = 0; first < mesh.vertices.length; first += 1) {
    for (let second = first + 1; second < mesh.vertices.length; second += 1) {
      const a = mesh.vertices[first]
      const b = mesh.vertices[second]
      result.set(
        `${a.id}|${b.id}`,
        Math.hypot(
          a.position.x - b.position.x,
          a.position.y - b.position.y,
          a.position.z - b.position.z,
        ),
      )
    }
  }
  return result
}

describe.each(solids)('$name fold adapter', ({ create }) => {
  it.each([10, 80])(
    'preserves the flat net and closes at edge length %i mm',
    (edgeLengthMm) => {
      const mesh = create(edgeLengthMm)
      const unfolded = unfoldPolyhedron(mesh)
      expect(unfolded.success).toBe(true)
      if (!unfolded.success) return
      const graph = createPolyhedronFoldGraph(unfolded.layout, mesh)
      expect(graph.hinges).toHaveLength(mesh.faces.length - 1)
      const zeroPoses = new Map(
        solveFoldPoses(graph, 0).map((pose) => [pose.faceId, pose]),
      )
      const midpoint = solveFoldPoses(graph, 0.5)
      expect(
        midpoint.every((pose) =>
          [
            pose.transform.rotation.x,
            pose.transform.rotation.y,
            pose.transform.rotation.z,
            pose.transform.rotation.w,
          ].every(Number.isFinite),
        ),
      ).toBe(true)

      for (const face of unfolded.layout.faces) {
        const center = faceCenter(face)
        const pose = zeroPoses.get(face.id)!
        face.vertexIds.forEach((vertexId, index) => {
          const point = transformPoint(pose.transform, {
            x: face.polygon[index].x - center.x,
            y: face.polygon[index].y - center.y,
            z: 0,
          })
          expect(point.x).toBeCloseTo(face.polygon[index].x, 7)
          expect(point.y).toBeCloseTo(face.polygon[index].y, 7)
          expect(point.z).toBeCloseTo(0, 7)
          expect(vertexId).toBe(
            mesh.faces.find((item) => item.id === face.id)!.vertexIds[index],
          )
        })
      }

      const endPoses = new Map(
        solveFoldPoses(graph, 1).map((pose) => [pose.faceId, pose]),
      )
      const foldedVertices = new Map<
        string,
        Array<{ x: number; y: number; z: number }>
      >()
      for (const face of unfolded.layout.faces) {
        const center = faceCenter(face)
        const pose = endPoses.get(face.id)!
        face.vertexIds.forEach((vertexId, index) => {
          const point = transformPoint(pose.transform, {
            x: face.polygon[index].x - center.x,
            y: face.polygon[index].y - center.y,
            z: 0,
          })
          const points = foldedVertices.get(vertexId) ?? []
          points.push(point)
          foldedVertices.set(vertexId, points)
        })
      }
      for (const points of foldedVertices.values()) {
        for (const point of points.slice(1)) {
          expect(point.x).toBeCloseTo(points[0].x, 5)
          expect(point.y).toBeCloseTo(points[0].y, 5)
          expect(point.z).toBeCloseTo(points[0].z, 5)
        }
      }
      const expected = modelDistances(mesh)
      for (const [pair, distance] of expected) {
        const [firstId, secondId] = pair.split('|')
        const first = foldedVertices.get(firstId)![0]
        const second = foldedVertices.get(secondId)![0]
        expect(
          Math.hypot(
            first.x - second.x,
            first.y - second.y,
            first.z - second.z,
          ),
        ).toBeCloseTo(distance, 5)
      }
    },
  )
})
