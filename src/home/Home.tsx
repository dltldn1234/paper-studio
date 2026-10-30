import { HomeHeader } from './HomeHeader'
import { HomeHero } from './HomeHero'
import { QuickStart } from './QuickStart'
import { TemplateGallery } from './TemplateGallery'
import { GettingStarted } from './GettingStarted'
import { Modal } from './Modal'
import { useState, useRef, useEffect } from 'react'
import {
  ArrowUpRight,
  Plus,
  FolderOpen,
  Pencil,
  Trash2,
  X,
  Check,
  FileUp,
} from 'lucide-react'
import {
  activateProject,
  initializeProjects,
  renameProject,
  deleteProject,
  type SavedProject,
} from '../persistence/projects'
import { parseProject, type PaperStudioProject } from '../project/project-file'
import { templateProject } from './templates'
import { SolidThumbnail } from './SolidThumbnail'
import { mountLandingMotion } from '../landing/landingMotion'
import './home.css'

export default function Home() {
  const [initial] = useState(() => {
    try {
      return { entries: initializeProjects(), error: '' }
    } catch {
      return {
        entries: [] as SavedProject[],
        error:
          '저장된 프로젝트를 읽지 못했습니다. 데이터는 보존되어 있습니다. 에디터에서 파일을 열거나 저장 공간을 확인하세요.',
      }
    }
  })
  const [projects, setProjects] = useState(initial.entries)
  const [error, setError] = useState(initial.error)
  const [query, setQuery] = useState('')
  const [settings, setSettings] = useState(false)
  const [editing, setEditing] = useState<SavedProject | null>(null)
  const [deleting, setDeleting] = useState<SavedProject | null>(null)
  const [name, setName] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const page = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = page.current
    if (!root) return
    const motion = mountLandingMotion(root)
    return () => motion.dispose()
  }, [])
  useEffect(() => {
    const refresh = () => {
      try {
        setProjects(initializeProjects())
        setError('')
      } catch {
        setError(
          '프로젝트 목록을 새로 읽지 못했습니다. 저장 데이터는 보존됩니다.',
        )
      }
    }
    window.addEventListener('pageshow', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  function run(action: () => void) {
    try {
      action()
      setProjects(initializeProjects())
      setError('')
    } catch {
      setError(
        '작업을 저장하지 못했습니다. 브라우저 저장 공간 또는 프로젝트 데이터를 확인하세요. 원본 파일을 별도로 보관하세요.',
      )
    }
  }
  function open(project: PaperStudioProject, id?: string) {
    run(() => {
      activateProject(project, id)
      window.location.assign('/studio')
    })
  }
  return (
    <div className="home-page" ref={page}>
      <a className="home-skip" href="#home-main">
        본문으로 건너뛰기
      </a>
      <HomeHeader
        query={query}
        onQueryChange={setQuery}
        onSettings={() => setSettings(true)}
      />
      <main id="home-main" className="home-main">
        {error && (
          <div className="home-error" role="alert">
            {error} <a href="/studio">에디터 열기</a>
          </div>
        )}
        <HomeHero onCreate={() => open(templateProject('cuboid'))} />
        <QuickStart onCreate={() => open(templateProject('cuboid'))} />
        <TemplateGallery onOpen={open} />
        <section id="recent" className="home-section" data-motion-reveal>
          <div className="home-section-heading">
            <div>
              <span className="home-eyebrow">PICK UP WHERE YOU LEFT OFF</span>
              <h2>최근 프로젝트</h2>
            </div>
            <button
              className="home-text-button"
              onClick={() => input.current?.click()}
            >
              <FileUp size={16} />
              프로젝트 파일 열기
            </button>
            <input
              ref={input}
              hidden
              type="file"
              accept=".json,.paperstudio.json"
              aria-label="홈 프로젝트 파일"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) {
                  try {
                    open(parseProject(await file.text()))
                  } catch {
                    setError(
                      '지원하지 않거나 손상된 프로젝트 파일입니다. 기존 저장 데이터는 유지됩니다.',
                    )
                  }
                }
              }}
            />
          </div>
          {projects.length === 0 ? (
            <div className="home-empty">
              <span>
                <FolderOpen size={28} />
              </span>
              <h3>첫 번째 아이디어를 펼쳐보세요.</h3>
              <p>
                만든 프로젝트가 여기에 표시됩니다.
                <br />이 브라우저에 자동으로 저장되어 언제든 이어갈 수 있어요.
              </p>
              <button
                className="home-secondary"
                onClick={() => open(templateProject('cuboid'))}
              >
                <Plus size={16} />첫 프로젝트 만들기
              </button>
            </div>
          ) : (
            <div className="home-recent-grid">
              {projects
                .filter((item) =>
                  item.project.name
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
                )
                .map((item) => (
                  <article className="home-project" key={item.id}>
                    <button
                      className="home-project-open"
                      onClick={() => open(item.project, item.id)}
                    >
                      <SolidThumbnail project={item.project} />
                      <strong>{item.project.name}</strong>
                      <small>
                        수정 {new Date(item.updatedAt).toLocaleString('ko-KR')}
                      </small>
                      <span>
                        열기 <ArrowUpRight size={15} />
                      </span>
                    </button>
                    <div className="home-project-actions">
                      <button
                        aria-label={`${item.project.name} 이름 변경`}
                        onClick={() => {
                          setEditing(item)
                          setName(item.project.name)
                        }}
                      >
                        <Pencil size={15} />
                        이름 변경
                      </button>
                      <button
                        aria-label={`${item.project.name} 삭제`}
                        onClick={() => setDeleting(item)}
                      >
                        <Trash2 size={15} />
                        삭제
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          )}
          {projects.length > 0 &&
            !projects.some((item) =>
              item.project.name
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase()),
            ) && <p className="home-empty">검색 결과가 없습니다.</p>}
        </section>
        <GettingStarted />
        <footer className="home-footer">
          <span>
            paper.studio <small>종이로 펼치는 새로운 차원</small>
          </span>
          <span>로컬 저장 · 계정 없이 시작 · PDF 출력</span>
        </footer>
      </main>
      {settings && (
        <Modal labelledBy="settings-title" onClose={() => setSettings(false)}>
          <button
            className="home-dialog-close home-icon"
            aria-label="설정 닫기"
            onClick={() => setSettings(false)}
          >
            <X />
          </button>
          <h2 id="settings-title">워크스페이스 설정</h2>
          <h3>브라우저 로컬 저장</h3>
          <p>
            계정 없이 이 기기에서 작업합니다. 프로젝트는 자동 저장되며 다른
            브라우저와 동기화되지 않습니다.
          </p>
          <p>
            에디터의 프로젝트 저장 버튼으로 JSON 백업을 다운로드하세요. PDF는
            출력용이며 편집용 백업은 JSON입니다.
          </p>
          <h3>화면 움직임</h3>
          <p>
            운영체제의 동작 줄이기 설정을 따릅니다. 홈 미리보기는 직접
            드래그하거나 슬라이더로 조절할 수 있습니다.
          </p>
          <button
            className="home-primary"
            autoFocus
            onClick={() => setSettings(false)}
          >
            <Check size={16} />
            확인
          </button>
        </Modal>
      )}
      {editing && (
        <Modal labelledBy="rename-title" onClose={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              run(() => renameProject(editing.id, name))
              setEditing(null)
            }}
          >
            <h2 id="rename-title">프로젝트 이름 변경</h2>
            <input
              aria-label="새 프로젝트 이름"
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="home-dialog-actions">
              <button
                type="button"
                className="home-secondary"
                onClick={() => setEditing(null)}
              >
                취소
              </button>
              <button className="home-primary" disabled={!name.trim()}>
                저장
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal labelledBy="delete-title" onClose={() => setDeleting(null)}>
          <h2 id="delete-title">프로젝트를 삭제할까요?</h2>
          <p>
            “{deleting.project.name}”의 브라우저 저장 데이터를 삭제합니다. 이
            작업은 되돌릴 수 없습니다.
          </p>
          <div className="home-dialog-actions">
            <button
              className="home-secondary"
              autoFocus
              onClick={() => setDeleting(null)}
            >
              취소
            </button>
            <button
              className="home-primary"
              onClick={() => {
                run(() => deleteProject(deleting.id))
                setDeleting(null)
              }}
            >
              삭제 확인
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
