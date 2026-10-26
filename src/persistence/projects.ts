import {
  parseProject,
  serializeProject,
  type PaperStudioProject,
} from '../project/project-file'

const KEY = 'paper-studio.projects.v1'
const DRAFT_KEY = 'paper-studio.editor-workspace.v1'
export type SavedProject = {
  id: string
  updatedAt: string
  project: PaperStudioProject
}
type Library = { activeId: string | null; entries: SavedProject[] }
export function readProjects(): Library {
  const raw = localStorage.getItem(KEY)
  if (!raw) return { activeId: null, entries: [] }
  const value = JSON.parse(raw) as Library
  if (
    !Array.isArray(value.entries) ||
    !(value.activeId === null || typeof value.activeId === 'string')
  )
    throw new Error(
      '프로젝트 목록을 읽을 수 없습니다. 기존 데이터는 보존됩니다.',
    )
  return {
    activeId: value.activeId,
    entries: value.entries.map((entry) => {
      if (
        typeof entry.id !== 'string' ||
        !Number.isFinite(Date.parse(entry.updatedAt))
      )
        throw new Error('프로젝트 목록 데이터가 올바르지 않습니다.')
      return { ...entry, project: parseProject(JSON.stringify(entry.project)) }
    }),
  }
}
function write(library: Library) {
  localStorage.setItem(KEY, JSON.stringify(library))
}
// Both keys remain readable by older releases. Roll back if the second write fails.
function writeWithDraft(library: Library, project: PaperStudioProject | null) {
  const previous = localStorage.getItem(KEY)
  const serialized = project ? serializeProject(project) : null
  write(library)
  try {
    if (serialized) localStorage.setItem(DRAFT_KEY, serialized)
    else localStorage.removeItem(DRAFT_KEY)
  } catch (error) {
    if (previous === null) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, previous)
    throw error
  }
}
export function saveActiveProject(
  project: PaperStudioProject,
  projectId?: string,
) {
  const library = readProjects()
  const id = projectId ?? library.activeId ?? crypto.randomUUID()
  const previous = library.entries.find((entry) => entry.id === id)
  if (
    previous &&
    serializeProject(previous.project) === serializeProject(project)
  ) {
    if (library.activeId !== id) write({ ...library, activeId: id })
    return
  }
  write({
    activeId: id,
    entries: [
      { id, updatedAt: new Date().toISOString(), project },
      ...library.entries.filter((entry) => entry.id !== id),
    ],
  })
}
export function initializeProjects() {
  const library = readProjects()
  if (!library.entries.length && !localStorage.getItem(KEY)) {
    const draft = localStorage.getItem('paper-studio.editor-workspace.v1')
    if (draft) saveActiveProject(parseProject(draft))
  }
  return readProjects().entries
}
export function activateProject(
  project: PaperStudioProject,
  id: string = crypto.randomUUID(),
) {
  initializeProjects()
  const library = readProjects()
  const previous = library.entries.find((entry) => entry.id === id)
  const updatedAt =
    previous && serializeProject(previous.project) === serializeProject(project)
      ? previous.updatedAt
      : new Date().toISOString()
  writeWithDraft(
    {
      activeId: id,
      entries: [
        { id, project, updatedAt },
        ...library.entries.filter((entry) => entry.id !== id),
      ],
    },
    project,
  )
}
export function renameProject(id: string, name: string) {
  if (!name.trim()) throw new Error('프로젝트 이름을 입력하세요.')
  const library = readProjects()
  const entry = library.entries.find((item) => item.id === id)
  if (!entry) return
  entry.project = { ...entry.project, name: name.trim() }
  entry.updatedAt = new Date().toISOString()
  if (library.activeId === id) writeWithDraft(library, entry.project)
  else write(library)
}
export function deleteProject(id: string) {
  const library = readProjects()
  const next = {
    activeId: library.activeId === id ? null : library.activeId,
    entries: library.entries.filter((item) => item.id !== id),
  }
  if (library.activeId === id) writeWithDraft(next, null)
  else write(next)
}

export function workspaceProjectId(): string {
  try {
    return readProjects().activeId ?? crypto.randomUUID()
  } catch {
    return crypto.randomUUID()
  }
}
