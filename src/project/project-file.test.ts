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
    glueTabOptions: {
      enabled: true,
      widthMm: 10,
      angleDeg: 45,
      shape: 'beveled',
      direction: 'inward',
      disabledEdgeIds: ['edge-9'],
    },
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
    faceMaterials: {
      'face-1': {
        color: '#aabbcc',
        texture: {
          dataUrl: 'data:image/png;base64,aGVsbG8=',
          offsetX: 2,
          offsetY: -3,
          scale: 1.5,
          rotationDeg: 45,
        },
      },
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

  it('migrates existing version 1 projects with empty face materials', () => {
    const versionTwo = validProject()
    const versionOne: Record<string, unknown> = {
      ...versionTwo,
      version: 1,
    }
    delete versionOne.faceMaterials

    expect(parseProject(JSON.stringify(versionOne))).toMatchObject({
      version: 2,
      faceMaterials: {},
    })
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
