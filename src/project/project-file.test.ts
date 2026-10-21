import { describe, expect, it } from 'vitest'
import {
  createProjectDocument,
  parseProject,
  serializeProject,
} from './project-file'

const validProject = () =>
  createProjectDocument({
    solidKind: 'octahedron',
    dimensions: { widthMm: 100, depthMm: 80, heightMm: 60 },
    edgeLengthMm: 100,
    glueTabOptions: { enabled: true, widthMm: 10, angleDeg: 45 },
    customFoldEdgeIds: ['edge-1', 'edge-3'],
    selectedFaceId: 'face-1',
    selectedEdgeId: 'edge-2',
    foldProgress: 0.4,
    printSettings: {
      paperSize: 'A3',
      orientation: 'landscape',
      marginMm: 10,
      overlapMm: 8,
    },
  })

describe('versioned project files', () => {
  it('round trips solid, dimension, editor, and print state', () => {
    const project = validProject()
    expect(parseProject(serializeProject(project))).toEqual(project)
  })

  it('rejects malformed JSON and unsupported versions', () => {
    expect(() => parseProject('{')).toThrow('not valid JSON')
    expect(() => parseProject('{"version":99}')).toThrow(
      'Unsupported project file version',
    )
  })

  it('rejects invalid dimensions, selections, and print options', () => {
    const project = validProject()
    expect(() =>
      parseProject(
        JSON.stringify({
          ...project,
          dimensions: { ...project.dimensions, widthMm: 0 },
        }),
      ),
    ).toThrow('dimensions are outside')
    expect(() =>
      parseProject(
        JSON.stringify({ ...project, customFoldEdgeIds: ['edge-1', 'edge-1'] }),
      ),
    ).toThrow('custom fold edges are invalid')
    expect(() =>
      parseProject(
        JSON.stringify({
          ...project,
          printSettings: { ...project.printSettings, paperSize: 'Letter' },
        }),
      ),
    ).toThrow('print settings are invalid')
  })

  it('rejects fold progress outside the animation range', () => {
    expect(() =>
      parseProject(JSON.stringify({ ...validProject(), foldProgress: 1.1 })),
    ).toThrow('fold progress must be between 0 and 1')
  })
})
