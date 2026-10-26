import { beforeEach, expect, it, vi } from 'vitest'
import {
  activateProject,
  deleteProject,
  initializeProjects,
  readProjects,
  renameProject,
  saveActiveProject,
} from './projects'
import {
  sampleProject,
  readEditorDraft,
  writeEditorDraft,
} from './editor-draft'
import { serializeProject } from '../project/project-file'
const KEY = 'paper-studio.projects.v1'
const DRAFT = 'paper-studio.editor-workspace.v1'
beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
it('starts empty and migrates a legacy draft once, preserving all project fields', () => {
  expect(initializeProjects()).toEqual([])
  const project = {
    ...sampleProject(),
    name: 'Legacy',
    faceMaterials: { face0: { color: '#367bff' } },
    assemblyStepIndex: 2,
  }
  localStorage.setItem(DRAFT, serializeProject(project))
  const [entry] = initializeProjects()
  expect(entry.project).toEqual(project)
  expect(initializeProjects()).toEqual([entry])
  expect(localStorage.getItem(DRAFT)).toBe(serializeProject(project))
})
it('archives existing work before creating another project and restores exact editor state', () => {
  writeEditorDraft('workspace', { ...sampleProject(), name: 'First' })
  const first = readProjects().entries[0]
  activateProject({ ...sampleProject(), name: 'Second' })
  expect(readProjects().entries).toHaveLength(2)
  activateProject(first.project, first.id)
  expect(readEditorDraft('workspace')).toEqual(first.project)
  writeEditorDraft('workspace', { ...first.project, edgeLengthMm: 155 })
  expect(
    readProjects().entries.find((entry) => entry.id === first.id)?.project
      .edgeLengthMm,
  ).toBe(155)
  expect(readProjects().entries).toHaveLength(2)
})
it('does not update modification time for unchanged snapshots or mix sample projects', () => {
  writeEditorDraft('workspace', sampleProject())
  const original = readProjects()
  saveActiveProject(sampleProject())
  writeEditorDraft('sample', { ...sampleProject(), name: 'Sample' })
  expect(readProjects()).toEqual(original)
})
it('renames both active draft and library, rejects empty names and deletes without resurrection', () => {
  activateProject(sampleProject())
  const id = readProjects().activeId!
  renameProject(id, '  Renamed  ')
  expect(readEditorDraft('workspace')?.name).toBe('Renamed')
  expect(() => renameProject(id, '  ')).toThrow()
  deleteProject(id)
  expect(initializeProjects()).toEqual([])
  expect(readEditorDraft('workspace')).toBeNull()
})
it('preserves corrupt library and legacy data rather than silently overwriting it', () => {
  localStorage.setItem(KEY, 'broken')
  expect(() => activateProject(sampleProject())).toThrow()
  expect(localStorage.getItem(KEY)).toBe('broken')
  localStorage.clear()
  localStorage.setItem(DRAFT, 'legacy broken')
  expect(() => initializeProjects()).toThrow()
  expect(localStorage.getItem(DRAFT)).toBe('legacy broken')
})
it('rolls back project activation if the compatible draft write hits quota', () => {
  activateProject({ ...sampleProject(), name: 'Retained' })
  const previous = readProjects()
  const setItem = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
    this: Storage,
    key,
    value,
  ) {
    if (key === DRAFT) throw new DOMException('quota', 'QuotaExceededError')
    setItem.call(this, key, value)
  })
  expect(() =>
    activateProject({ ...sampleProject(), name: 'Not saved' }),
  ).toThrow()
  expect(readProjects()).toEqual(previous)
  expect(readEditorDraft('workspace')?.name).toBe('Retained')
})

it('keeps a mounted editor snapshot attached to its own project after another project opens', () => {
  activateProject({ ...sampleProject(), name: 'First editor' })
  const firstId = readProjects().activeId!
  activateProject({ ...sampleProject(), name: 'Second editor' })
  const secondId = readProjects().activeId!
  writeEditorDraft(
    'workspace',
    { ...sampleProject(), name: 'First edited' },
    firstId,
  )
  expect(
    readProjects().entries.find((entry) => entry.id === secondId)?.project.name,
  ).toBe('Second editor')
  expect(
    readProjects().entries.find((entry) => entry.id === firstId)?.project.name,
  ).toBe('First edited')
})

it('keeps last modification time when reopening and synchronizes unchanged history snapshots', () => {
  activateProject({ ...sampleProject(), name: 'First' })
  const first = readProjects().entries[0]
  const library = readProjects()
  library.entries[0].updatedAt = '2020-01-01T00:00:00.000Z'
  localStorage.setItem(KEY, JSON.stringify(library))
  activateProject(first.project, first.id)
  expect(readProjects().entries[0].updatedAt).toBe('2020-01-01T00:00:00.000Z')
  activateProject({ ...sampleProject(), name: 'Second' })
  writeEditorDraft('workspace', first.project, first.id)
  expect(readProjects().activeId).toBe(first.id)
  expect(
    readProjects().entries.find((entry) => entry.id === first.id)?.updatedAt,
  ).toBe('2020-01-01T00:00:00.000Z')
  renameProject(first.id, 'Updated name')
  expect(
    readProjects().entries.find((entry) => entry.id === first.id)?.updatedAt,
  ).not.toBe('2020-01-01T00:00:00.000Z')
})
