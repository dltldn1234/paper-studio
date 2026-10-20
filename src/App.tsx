import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import {
  Box,
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus2,
  FolderTree,
  Grid2X2,
  Layers3,
  MoreHorizontal,
  MousePointer2,
  Redo2,
  Ruler,
  Settings2,
  Undo2,
} from 'lucide-react'
import { CuboidNetCanvas } from './canvas/CuboidNetCanvas'
import {
  createCuboid,
  createCuboidNet,
  MAX_DIMENSION_MM,
  MIN_DIMENSION_MM,
  validateCuboidDimensions,
} from './geometry'
import type { CuboidDimensions, FaceId } from './geometry'

const ThreeCuboidPreview = lazy(() =>
  import('./preview/ThreeCuboidPreview').then((module) => ({
    default: module.ThreeCuboidPreview,
  })),
)

const DEFAULT_DIMENSIONS: CuboidDimensions = {
  widthMm: 100,
  depthMm: 80,
  heightMm: 60,
}

const DIMENSION_FIELDS: {
  key: keyof CuboidDimensions
  label: string
  shortLabel: string
}[] = [
  { key: 'widthMm', label: '너비', shortLabel: 'W' },
  { key: 'depthMm', label: '깊이', shortLabel: 'D' },
  { key: 'heightMm', label: '높이', shortLabel: 'H' },
]

type ResizeDrag = {
  panel: 'sidebar' | 'preview'
  startX: number
  startWidth: number
}

function App() {
  const [dimensions, setDimensions] = useState(DEFAULT_DIMENSIONS)
  const [dimensionDrafts, setDimensionDrafts] = useState({
    widthMm: '100',
    depthMm: '80',
    heightMm: '60',
  })
  const [dimensionErrors, setDimensionErrors] = useState<
    Partial<Record<keyof CuboidDimensions, string>>
  >({})
  const [selectedFaceId, setSelectedFaceId] = useState<FaceId | null>('front')
  const [sidebarWidth, setSidebarWidth] = useState(232)
  const [previewWidth, setPreviewWidth] = useState(410)
  const [resizeDrag, setResizeDrag] = useState<ResizeDrag | null>(null)

  const cuboid = useMemo(() => createCuboid(dimensions), [dimensions])
  const netLayout = useMemo(() => createCuboidNet(dimensions), [dimensions])
  const selectedFace = cuboid.faces.find((face) => face.id === selectedFaceId)

  useEffect(() => {
    if (!resizeDrag) return

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const delta = event.clientX - resizeDrag.startX
      if (resizeDrag.panel === 'sidebar') {
        setSidebarWidth(
          Math.min(340, Math.max(184, resizeDrag.startWidth + delta)),
        )
      } else {
        setPreviewWidth(
          Math.min(620, Math.max(330, resizeDrag.startWidth - delta)),
        )
      }
    }
    const handlePointerUp = () => setResizeDrag(null)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [resizeDrag])

  function startResize(
    panel: ResizeDrag['panel'],
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault()
    setResizeDrag({
      panel,
      startX: event.clientX,
      startWidth: panel === 'sidebar' ? sidebarWidth : previewWidth,
    })
  }

  function resizeWithKeyboard(panel: ResizeDrag['panel'], key: string) {
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return
    const direction = key === 'ArrowRight' ? 1 : -1
    if (panel === 'sidebar') {
      setSidebarWidth((current) =>
        Math.min(340, Math.max(184, current + direction * 12)),
      )
    } else {
      setPreviewWidth((current) =>
        Math.min(620, Math.max(330, current - direction * 12)),
      )
    }
  }

  function updateDimension(field: keyof CuboidDimensions, value: string) {
    const nextDrafts = { ...dimensionDrafts, [field]: value }
    setDimensionDrafts(nextDrafts)

    const nextDimensions: CuboidDimensions = {
      widthMm: Number(nextDrafts.widthMm),
      depthMm: Number(nextDrafts.depthMm),
      heightMm: Number(nextDrafts.heightMm),
    }
    const validation = validateCuboidDimensions(nextDimensions)
    if (validation.valid) {
      setDimensions(nextDimensions)
      setDimensionErrors({})
      return
    }

    setDimensionErrors(
      Object.fromEntries(
        validation.issues.map((issue) => [issue.field, issue.message]),
      ),
    )
  }

  const workspaceStyle = {
    '--sidebar-width': `${sidebarWidth}px`,
    '--preview-width': `${previewWidth}px`,
  } as CSSProperties

  return (
    <div className="studio-shell" style={workspaceStyle}>
      <header className="studio-topbar">
        <a
          className="studio-brand"
          href="#workspace"
          aria-label="Paper Studio 홈"
        >
          <span className="studio-brand__mark">
            <Box size={17} strokeWidth={1.8} />
          </span>
          <span>
            paper<span className="studio-brand__dot">.</span>studio
          </span>
        </a>
        <div className="topbar-divider" />
        <div className="document-title">
          <span className="document-title__eyebrow">새 프로젝트</span>
          <strong>직육면체 설계</strong>
          <ChevronDown size={13} />
        </div>
        <div className="topbar-spacer" />
        <span className="local-state">
          <span /> 브라우저에서 작업 중
        </span>
        <button
          className="icon-button topbar-icon"
          type="button"
          aria-label="실행 취소"
          disabled
        >
          <Undo2 size={16} />
        </button>
        <button
          className="icon-button topbar-icon"
          type="button"
          aria-label="다시 실행"
          disabled
        >
          <Redo2 size={16} />
        </button>
        <button
          className="export-button"
          type="button"
          disabled
          title="PDF/SVG 내보내기는 다음 단계에서 제공됩니다"
        >
          <Download size={15} /> 내보내기
        </button>
        <button
          className="icon-button topbar-icon"
          type="button"
          aria-label="더 보기"
          disabled
        >
          <MoreHorizontal size={18} />
        </button>
      </header>

      <main className="studio-workspace" id="workspace">
        <aside className="project-sidebar" aria-label="프로젝트 및 구조물 패널">
          <div className="sidebar-heading">
            <span>프로젝트</span>
            <button
              className="icon-button sidebar-action"
              type="button"
              aria-label="새 프로젝트"
              disabled
            >
              <FilePlus2 size={15} />
            </button>
          </div>
          <div className="project-card">
            <span className="project-card__icon">
              <FolderTree size={15} />
            </span>
            <span className="project-card__copy">
              <strong>새 프로젝트</strong>
              <small>수정 중</small>
            </span>
            <ChevronDown size={13} />
          </div>

          <div className="sidebar-section-label">
            <span>구조물</span>
            <span>01</span>
          </div>
          <button className="object-row is-active" type="button">
            <Box size={15} />
            <span>직육면체</span>
            <span className="object-row__dot" />
          </button>

          <div className="sidebar-section-label sidebar-section-label--spaced">
            <span>도구</span>
            <Settings2 size={13} />
          </div>
          <button className="tool-row is-active" type="button">
            <MousePointer2 size={15} />
            <span>선택</span>
            <kbd>V</kbd>
          </button>
          <button
            className="tool-row"
            type="button"
            disabled
            title="전개도 편집은 이후 단계에서 제공됩니다"
          >
            <Grid2X2 size={15} />
            <span>면 편집</span>
            <kbd>G</kbd>
          </button>
          <button
            className="tool-row"
            type="button"
            disabled
            title="접힘 시뮬레이션은 이후 단계에서 제공됩니다"
          >
            <Layers3 size={15} />
            <span>접힘 선</span>
            <kbd>F</kbd>
          </button>

          <div className="sidebar-note">
            <span className="sidebar-note__icon">
              <Ruler size={15} />
            </span>
            <p>
              <strong>밀리미터 단위</strong>
              <br />
              실제 제작 치수로 설계합니다.
            </p>
          </div>
          <div className="sidebar-bottom">
            LOCAL SESSION <span>•</span> 변경사항은 현재 탭에만 유지됩니다
          </div>
        </aside>

        <div
          className="panel-splitter panel-splitter--sidebar"
          role="separator"
          aria-label="프로젝트 패널 너비 조절"
          aria-orientation="vertical"
          aria-valuemin={184}
          aria-valuemax={340}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={(event) => startResize('sidebar', event)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
              event.preventDefault()
            resizeWithKeyboard('sidebar', event.key)
          }}
        />

        <section className="net-panel" aria-label="2D 전개도 편집기">
          <div className="panel-toolbar">
            <div className="panel-toolbar__title">
              <span className="mode-indicator">2D</span>
              <strong>전개도</strong>
              <span className="toolbar-separator" />
              <span className="subtle-label">A4 · 세로</span>
            </div>
            <div className="panel-toolbar__actions">
              <span className="legend-item">
                <i className="legend-line legend-line--cut" /> 재단선
              </span>
              <span className="legend-item">
                <i className="legend-line legend-line--fold" /> 접힘선
              </span>
            </div>
          </div>
          <div className="net-panel__viewport">
            <CuboidNetCanvas
              layout={netLayout}
              selectedFaceId={selectedFaceId}
              onFaceSelect={setSelectedFaceId}
            />
          </div>
        </section>

        <div
          className="panel-splitter panel-splitter--preview"
          role="separator"
          aria-label="3D 및 속성 패널 너비 조절"
          aria-orientation="vertical"
          aria-valuemin={330}
          aria-valuemax={620}
          aria-valuenow={previewWidth}
          tabIndex={0}
          onPointerDown={(event) => startResize('preview', event)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
              event.preventDefault()
            resizeWithKeyboard('preview', event.key)
          }}
        />

        <aside className="inspector-panel" aria-label="3D 미리보기 및 속성">
          <section className="preview-block" aria-label="3D 미리보기">
            <div className="panel-toolbar panel-toolbar--preview">
              <div className="panel-toolbar__title">
                <span className="mode-indicator mode-indicator--3d">3D</span>
                <strong>미리보기</strong>
              </div>
              <span className="preview-live">
                <span /> LIVE
              </span>
            </div>
            <Suspense
              fallback={<div className="preview-loading">3D 모델 준비 중…</div>}
            >
              <ThreeCuboidPreview
                cuboid={cuboid}
                selectedFaceId={selectedFaceId}
                onFaceSelect={setSelectedFaceId}
              />
            </Suspense>
          </section>

          <section className="inspector-content" aria-label="속성 인스펙터">
            <div className="inspector-heading">
              <div>
                <span className="inspector-eyebrow">INSPECTOR</span>
                <h2>속성</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="속성 더 보기"
                disabled
              >
                <MoreHorizontal size={17} />
              </button>
            </div>
            <div className="inspector-object">
              <span className="inspector-object__icon">
                <Box size={16} />
              </span>
              <span>
                <strong>직육면체</strong>
                <small>기본 입체 · 6개 면</small>
              </span>
              <span className="inspector-object__status">유효</span>
            </div>

            <div className="inspector-section-title">
              <span>치수</span>
              <span>단위: mm</span>
            </div>
            <div className="dimension-grid">
              {DIMENSION_FIELDS.map(({ key, label, shortLabel }) => (
                <label className="dimension-field" key={key}>
                  <span className="dimension-field__label">
                    <i>{shortLabel}</i>
                    {label}
                  </span>
                  <span
                    className={`dimension-input-wrap${dimensionErrors[key] ? 'has-error' : ''}`}
                  >
                    <input
                      type="number"
                      min={MIN_DIMENSION_MM}
                      max={MAX_DIMENSION_MM}
                      step="0.1"
                      inputMode="decimal"
                      aria-label={`${label} (mm)`}
                      aria-invalid={Boolean(dimensionErrors[key])}
                      aria-describedby={
                        dimensionErrors[key] ? `${key}-error` : undefined
                      }
                      value={dimensionDrafts[key]}
                      onChange={(event) =>
                        updateDimension(key, event.target.value)
                      }
                    />
                    <span>mm</span>
                  </span>
                  {dimensionErrors[key] && (
                    <small
                      className="dimension-error"
                      id={`${key}-error`}
                      role="alert"
                    >
                      {dimensionErrors[key]}
                    </small>
                  )}
                </label>
              ))}
            </div>

            <div className="inspector-section-title inspector-section-title--face">
              <span>선택한 면</span>
              <span>{selectedFaceId ? '선택됨' : '없음'}</span>
            </div>
            <div className="selected-face-card" aria-live="polite">
              <span className="selected-face-card__swatch" />
              <span>
                <strong>{selectedFace?.label ?? '면을 선택하세요'}</strong>
                <small>
                  {selectedFace
                    ? `${selectedFace.widthMm} × ${selectedFace.heightMm} mm`
                    : '2D 또는 3D 뷰에서 선택'}
                </small>
              </span>
              <ChevronRight size={15} />
            </div>
            <div className="inspector-footnote">
              치수 범위 {MIN_DIMENSION_MM}–{MAX_DIMENSION_MM.toLocaleString()}{' '}
              mm
            </div>
          </section>
        </aside>
      </main>

      <footer className="studio-statusbar">
        <div>
          <span className="status-dot" /> 준비됨{' '}
          <span className="status-divider" /> 단위: mm
        </div>
        <div>
          <span>W {dimensions.widthMm}</span>
          <span> D {dimensions.depthMm}</span>
          <span> H {dimensions.heightMm}</span>
          <span className="status-divider" /> 6 faces · 12 edges
        </div>
      </footer>
    </div>
  )
}

export default App
