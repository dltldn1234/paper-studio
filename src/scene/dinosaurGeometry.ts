import { BufferGeometry, Float32BufferAttribute } from 'three'

export interface PaperSection {
  x: number
  y?: number
  z?: number
  height: number
  width: number
}

/** Closed faceted loft. Shared indexed vertices preserve real panel adjacency. */
export function paperLoft(
  sections: readonly PaperSection[],
  sides = 8,
): BufferGeometry {
  if (sections.length < 2 || sides < 3 || !Number.isInteger(sides)) {
    throw new Error(
      'A paper loft requires two sections and at least three sides',
    )
  }
  const positions: number[] = []
  for (const section of sections) {
    if (
      ![
        section.x,
        section.y ?? 0,
        section.z ?? 0,
        section.height,
        section.width,
      ].every(Number.isFinite) ||
      section.height <= 0 ||
      section.width <= 0
    ) {
      throw new Error(
        'Paper sections must have finite coordinates and positive dimensions',
      )
    }
    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * Math.PI * 2 + Math.PI / sides
      positions.push(
        section.x,
        (section.y ?? 0) + (Math.cos(angle) * section.height) / 2,
        (section.z ?? 0) + (Math.sin(angle) * section.width) / 2,
      )
    }
  }
  const indices: number[] = []
  for (let ring = 0; ring < sections.length - 1; ring++) {
    for (let side = 0; side < sides; side++) {
      const a = ring * sides + side
      const b = ring * sides + ((side + 1) % sides)
      const c = a + sides
      const d = b + sides
      indices.push(a, b, c, b, d, c)
    }
  }
  for (let side = 1; side < sides - 1; side++) {
    indices.push(0, side + 1, side)
    const end = (sections.length - 1) * sides
    indices.push(end, end + side, end + side + 1)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}
