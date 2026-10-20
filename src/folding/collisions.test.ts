import { describe, expect, it } from 'vitest'
import { createRegularCube, unfoldPolyhedron } from '../geometry'
import type { Point3D } from '../geometry'
import {
  createPolyhedronFoldGraph,
  detectPolyhedronFaceIntersections,
  intersectTriangles3D,
  solveFoldPoses,
} from './index'
import type { FoldPose } from './types'

describe('3D face collision detection', () => {
  it('detects a non-coplanar triangle crossing with representative points', () => {
    const hit = intersectTriangles3D(
      [
        { x: -1, y: -1, z: 0 },
        { x: 1, y: -1, z: 0 },
        { x: 0, y: 1, z: 0 },
      ],
      [
        { x: 0, y: -0.5, z: -1 },
        { x: 0, y: -0.5, z: 1 },
        { x: 0, y: 1, z: 0 },
      ],
    )
    expect(hit?.kind).toBe('crossing')
    expect(hit?.points.length).toBeGreaterThan(0)
    expect(hit?.points.every((point) => Math.abs(point.x) < 1e-7)).toBe(true)
  })

  it('detects coplanar overlap and rejects separated triangles', () => {
    const first: [Point3D, Point3D, Point3D] = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 0, y: 2, z: 0 },
    ]
    const overlap = intersectTriangles3D(first, [
      { x: 0.25, y: 0.25, z: 0 },
      { x: 1.5, y: 0.25, z: 0 },
      { x: 0.25, y: 1.5, z: 0 },
    ])
    expect(overlap?.kind).toBe('coplanar')
    expect(overlap?.points.length).toBeGreaterThan(0)
    expect(
      intersectTriangles3D(first, [
        { x: 0, y: 0, z: 3 },
        { x: 2, y: 0, z: 3 },
        { x: 0, y: 2, z: 3 },
      ]),
    ).toBeNull()
  })

  it('ignores adjacent hinge contact at flat and closed cube states', () => {
    const mesh = createRegularCube(20)
    const unfolded = unfoldPolyhedron(mesh)
    expect(unfolded.success).toBe(true)
    if (!unfolded.success) return
    const graph = createPolyhedronFoldGraph(unfolded.layout, mesh)
    for (const progress of [0, 1]) {
      const poses = solveFoldPoses(graph, progress)
      expect(
        detectPolyhedronFaceIntersections(mesh, unfolded.layout, poses),
      ).toEqual([])
    }
  })

  it('reports non-adjacent face IDs when their posed polygons overlap', () => {
    const mesh = createRegularCube(20)
    const unfolded = unfoldPolyhedron(mesh)
    expect(unfolded.success).toBe(true)
    if (!unfolded.success) return
    const graph = createPolyhedronFoldGraph(unfolded.layout, mesh)
    const poses = solveFoldPoses(graph, 0)
    const firstFaceId = 'face-z-positive'
    const secondFaceId = 'face-z-negative'
    const first = poses.find((pose) => pose.faceId === firstFaceId)!
    const overlapping: FoldPose[] = poses.map((pose) =>
      pose.faceId === secondFaceId
        ? {
            ...pose,
            transform: {
              ...pose.transform,
              translation: first.transform.translation,
            },
          }
        : pose,
    )
    const collisions = detectPolyhedronFaceIntersections(
      mesh,
      unfolded.layout,
      overlapping,
    )
    expect(
      collisions.some(
        (collision) =>
          [collision.firstFaceId, collision.secondFaceId].sort().join('|') ===
            [firstFaceId, secondFaceId].sort().join('|') &&
          collision.points.length > 0,
      ),
    ).toBe(true)
  })
})
