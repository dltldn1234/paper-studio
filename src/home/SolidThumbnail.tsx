import { createCuboid, createRegularPolyhedron } from '../geometry'
import type { PaperStudioProject } from '../project/project-file'

// Orthographic projection of the same canonical geometry used by the editor.
export function SolidThumbnail({ project }: { project: PaperStudioProject }) {
  const faces =
    project.solidKind === 'cuboid'
      ? createCuboid(project.dimensions).faces.map((face) => face.vertices)
      : (() => {
          const mesh = createRegularPolyhedron(
            project.solidKind,
            project.edgeLengthMm,
          )
          return mesh.faces.map((face) =>
            face.vertexIds.map(
              (id) =>
                mesh.vertices.find((vertex) => vertex.id === id)!.position,
            ),
          )
        })()
  const projected = faces
    .map((face) => ({
      depth: face.reduce((sum, p) => sum + p.z + p.x, 0) / face.length,
      points: face.map((p) => ({
        x: (p.x - p.z) * 0.76,
        y: (p.x + p.z) * 0.32 - p.y * 0.88,
      })),
    }))
    .sort((a, b) => a.depth - b.depth)
  const points = projected.flatMap((face) => face.points)
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x))
  const minY = Math.min(...points.map((p) => p.y)),
    maxY = Math.max(...points.map((p) => p.y))
  return (
    <svg
      className="home-solid"
      viewBox={`${minX - 35} ${minY - 25} ${maxX - minX + 70} ${maxY - minY + 50}`}
      aria-hidden="true"
    >
      {projected.map((face, index) => (
        <polygon
          key={index}
          points={face.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={['#6783ac', '#b5c9e3', '#e0e9f4', '#849fc5'][index % 4]}
          stroke="#162943"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
