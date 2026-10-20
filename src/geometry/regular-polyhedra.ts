import type { PolyhedronMesh, PolyhedronVertex } from './types'

export type RegularPolyhedronKind = 'tetrahedron' | 'cube' | 'octahedron'

function positiveEdgeLength(edgeLengthMm: number): number {
  if (!Number.isFinite(edgeLengthMm) || edgeLengthMm <= 0) {
    throw new RangeError(
      'Edge length must be a finite positive number of millimetres.',
    )
  }
  return edgeLengthMm
}

function vertex(id: string, x: number, y: number, z: number): PolyhedronVertex {
  return { id, position: { x, y, z } }
}

function signId(x: number, y: number, z: number): string {
  return `v${x > 0 ? '+' : '-'}${y > 0 ? '+' : '-'}${z > 0 ? '+' : '-'}`
}

function cubeFaceId(x: number, y: number, z: number): string {
  return signId(x, y, z)
}

/** Creates a centered regular tetrahedron with the requested edge length in mm. */
export function createRegularTetrahedron(edgeLengthMm: number): PolyhedronMesh {
  const edge = positiveEdgeLength(edgeLengthMm)
  const unit = edge / (2 * Math.sqrt(2))
  return {
    vertices: [
      vertex('a', unit, unit, unit),
      vertex('b', unit, -unit, -unit),
      vertex('c', -unit, unit, -unit),
      vertex('d', -unit, -unit, unit),
    ],
    faces: [
      { id: 'face-a', vertexIds: ['a', 'b', 'c'] },
      { id: 'face-b', vertexIds: ['a', 'd', 'b'] },
      { id: 'face-c', vertexIds: ['a', 'c', 'd'] },
      { id: 'face-d', vertexIds: ['b', 'd', 'c'] },
    ],
  }
}

/** Creates a centered regular cube with the requested edge length in mm. */
export function createRegularCube(edgeLengthMm: number): PolyhedronMesh {
  const edge = positiveEdgeLength(edgeLengthMm)
  const half = edge / 2
  const vertices: PolyhedronVertex[] = []
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        vertices.push(vertex(signId(x, y, z), x * half, y * half, z * half))
      }
    }
  }
  const id = (x: number, y: number, z: number) => cubeFaceId(x, y, z)
  return {
    vertices,
    faces: [
      {
        id: 'face-z-positive',
        vertexIds: [id(-1, -1, 1), id(1, -1, 1), id(1, 1, 1), id(-1, 1, 1)],
      },
      {
        id: 'face-z-negative',
        vertexIds: [id(-1, -1, -1), id(-1, 1, -1), id(1, 1, -1), id(1, -1, -1)],
      },
      {
        id: 'face-x-positive',
        vertexIds: [id(1, -1, -1), id(1, 1, -1), id(1, 1, 1), id(1, -1, 1)],
      },
      {
        id: 'face-x-negative',
        vertexIds: [id(-1, -1, -1), id(-1, -1, 1), id(-1, 1, 1), id(-1, 1, -1)],
      },
      {
        id: 'face-y-positive',
        vertexIds: [id(-1, 1, -1), id(-1, 1, 1), id(1, 1, 1), id(1, 1, -1)],
      },
      {
        id: 'face-y-negative',
        vertexIds: [id(-1, -1, -1), id(1, -1, -1), id(1, -1, 1), id(-1, -1, 1)],
      },
    ],
  }
}

/** Creates a centered regular octahedron with the requested edge length in mm. */
export function createRegularOctahedron(edgeLengthMm: number): PolyhedronMesh {
  const edge = positiveEdgeLength(edgeLengthMm)
  const radius = edge / Math.sqrt(2)
  const vertices = [
    vertex('x-positive', radius, 0, 0),
    vertex('x-negative', -radius, 0, 0),
    vertex('y-positive', 0, radius, 0),
    vertex('y-negative', 0, -radius, 0),
    vertex('z-positive', 0, 0, radius),
    vertex('z-negative', 0, 0, -radius),
  ]
  const faces = []
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        const vertexIds = [
          `x-${sx > 0 ? 'positive' : 'negative'}`,
          `y-${sy > 0 ? 'positive' : 'negative'}`,
          `z-${sz > 0 ? 'positive' : 'negative'}`,
        ]
        if (sx * sy * sz < 0) vertexIds.reverse()
        faces.push({ id: `face-${sx}-${sy}-${sz}`, vertexIds })
      }
    }
  }
  return { vertices, faces }
}

export function createRegularPolyhedron(
  kind: RegularPolyhedronKind,
  edgeLengthMm: number,
): PolyhedronMesh {
  switch (kind) {
    case 'tetrahedron':
      return createRegularTetrahedron(edgeLengthMm)
    case 'cube':
      return createRegularCube(edgeLengthMm)
    case 'octahedron':
      return createRegularOctahedron(edgeLengthMm)
  }
}
