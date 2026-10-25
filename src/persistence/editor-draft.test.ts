import { beforeEach, expect, it, vi } from 'vitest'
import {
  readEditorDraft,
  sampleProject,
  writeEditorDraft,
} from './editor-draft'

beforeEach(() => localStorage.clear())

it('isolates sample edits from the real workspace snapshot', () => {
  const project = { ...sampleProject(), name: 'My retained project' }
  expect(writeEditorDraft('workspace', project)).toBe(true)
  writeEditorDraft('sample', { ...sampleProject(), name: 'Sample experiment' })
  expect(readEditorDraft('workspace')).toEqual(project)
  expect(readEditorDraft('sample')?.name).toBe('Sample experiment')
})

it('recovers invalid storage and tolerates quota failures without deleting data', () => {
  localStorage.setItem('paper-studio.editor-workspace.v1', 'broken')
  expect(readEditorDraft('workspace')).toBeNull()
  expect(readEditorDraft('sample')?.solidKind).toBe('tetrahedron')
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  expect(writeEditorDraft('workspace', sampleProject())).toBe(false)
  spy.mockRestore()
  expect(localStorage.getItem('paper-studio.editor-workspace.v1')).toBe(
    'broken',
  )
})

it('keeps a recovery copy before replacing a corrupt draft and preserves project fields', () => {
  localStorage.setItem(
    'paper-studio.editor-workspace.v1',
    'original damaged data',
  )
  const project = sampleProject()
  project.faceMaterials = { face0: { color: '#3578ff' } }
  project.printSettings.paperSize = 'A3'
  project.assemblyStepIndex = 2
  writeEditorDraft('workspace', project)
  expect(
    localStorage.getItem('paper-studio.editor-workspace.v1.recovery'),
  ).toBe('original damaged data')
  expect(readEditorDraft('workspace')).toEqual(project)
})
