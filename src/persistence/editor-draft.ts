import {
  createProjectDocument,
  parseProject,
  serializeProject,
  type PaperStudioProject,
} from '../project/project-file'

export type EditorScope = 'workspace' | 'sample'
const key = (scope: EditorScope) => `paper-studio.editor-${scope}.v1`

export function sampleProject(): PaperStudioProject {
  return createProjectDocument({
    name: '샘플 — 정사면체 구조 연구',
    solidKind: 'tetrahedron',
    dimensions: { widthMm: 100, depthMm: 80, heightMm: 60 },
    edgeLengthMm: 100,
    glueTabOptions: { enabled: true, widthMm: 10, angleDeg: 45 },
    customFoldEdgeIds: null,
    selectedFaceId: null,
    selectedEdgeId: null,
    foldProgress: 0.65,
    printSettings: {
      paperSize: 'A4',
      orientation: 'portrait',
      marginMm: 10,
      overlapMm: 8,
      showCutLines: true,
      showFoldLines: true,
      showAssemblyNumbers: true,
    },
  })
}

export function readEditorDraft(scope: EditorScope): PaperStudioProject | null {
  try {
    const saved = localStorage.getItem(key(scope))
    if (saved) return parseProject(saved)
  } catch {
    /* A corrupt or unavailable draft must not block editor entry. */
  }
  return scope === 'sample' ? sampleProject() : null
}

export function writeEditorDraft(
  scope: EditorScope,
  project: PaperStudioProject,
): boolean {
  try {
    localStorage.setItem(key(scope), serializeProject(project))
    return true
  } catch {
    return false
  }
}
