import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import Home from './Home'
import { activateProject, readProjects } from '../persistence/projects'
import { templateProject, templates } from './templates'
import { parseProject, serializeProject } from '../project/project-file'
import {
  createCuboid,
  createRegularPolyhedron,
  unfoldPolyhedron,
} from '../geometry'
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
  localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(() => vi.unstubAllGlobals())
it('renders an honest empty state, supported templates, local storage information and guide', () => {
  render(<Home />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    '한 장의 종이에서,입체가 깨어나다.',
  )
  expect(
    screen.getByRole('figure', { name: '종이 구조가 입체로 접히는 장면' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /3D 장면 더 살펴보기/ }),
  ).toHaveAttribute('href', '/showcase')
  expect(
    screen.getByRole('heading', { name: '첫 번째 아이디어를 펼쳐보세요.' }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: 'PDF 내보내기 및 출력' }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('프로젝트 검색')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '설정' }))
  expect(screen.getByRole('dialog')).toHaveTextContent(
    '다른 브라우저와 동기화되지 않습니다.',
  )
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('searches real projects and persists rename and confirmed deletion', () => {
  activateProject({ ...templateProject('cube'), name: 'Alpha' })
  activateProject({ ...templateProject('tetrahedron'), name: 'Beta' })
  render(<Home />)
  fireEvent.change(screen.getByLabelText('프로젝트 검색'), {
    target: { value: 'Alpha' },
  })
  expect(
    screen.queryByRole('button', { name: 'Beta 이름 변경' }),
  ).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Alpha 이름 변경' }))
  fireEvent.change(screen.getByLabelText('새 프로젝트 이름'), {
    target: { value: 'Gamma' },
  })
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }),
  )
  expect(
    readProjects().entries.some((entry) => entry.project.name === 'Gamma'),
  ).toBe(true)
  fireEvent.change(screen.getByLabelText('프로젝트 검색'), {
    target: { value: '' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Gamma 삭제' }))
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  expect(readProjects().entries).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Gamma 삭제' }))
  fireEvent.click(screen.getByRole('button', { name: '삭제 확인' }))
  expect(readProjects().entries).toHaveLength(1)
})
it('surfaces malformed library data while keeping its original bytes', () => {
  localStorage.setItem('paper-studio.projects.v1', 'broken')
  render(<Home />)
  expect(screen.getByRole('alert')).toHaveTextContent('데이터는 보존')
  expect(localStorage.getItem('paper-studio.projects.v1')).toBe('broken')
})
it('creates every template as a compatible document with valid canonical geometry', () => {
  for (const template of templates) {
    const project = templateProject(template.kind)
    expect(parseProject(serializeProject(project))).toEqual(project)
    if (project.solidKind === 'cuboid')
      expect(createCuboid(project.dimensions).faces).toHaveLength(6)
    else
      expect(
        unfoldPolyhedron(
          createRegularPolyhedron(project.solidKind, project.edgeLengthMm),
        ).success,
      ).toBe(true)
  }
})
