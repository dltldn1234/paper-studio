import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import type {
  CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
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
  DEFAULT_GLUE_TAB_OPTIONS,
  MAX_GLUE_TAB_ANGLE_DEG,
  MAX_GLUE_TAB_WIDTH_MM,
  MAX_DIMENSION_MM,
  MIN_GLUE_TAB_ANGLE_DEG,
  MIN_GLUE_TAB_WIDTH_MM,
  MIN_DIMENSION_MM,
  validateCuboidDimensions,
} from './geometry'
import type { CuboidDimensions, FaceId, GlueTabOptions } from './geometry'
import { normalizeSvgFilename, serializeNetToSvg } from './export/svg'
import {
  computePrintLayout,
  type PageOrientation,
  type PaperSize,
  type PrintSettings,
} from './export/print-layout'
import { PrintPagePreviews } from './export/PrintPagePreviews'

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
  const [glueTabOptions, setGlueTabOptions] = useState<GlueTabOptions>({
    ...DEFAULT_GLUE_TAB_OPTIONS,
    enabled: true,
  })
  const [glueTabDrafts, setGlueTabDrafts] = useState({
    widthMm: '10',
    angleDeg: '45',
  })
  const [glueTabErrors, setGlueTabErrors] = useState<
    Partial<Record<'widthMm' | 'angleDeg', string>>
  >({})
  const [sidebarWidth, setSidebarWidth] = useState(232)
  const [previewWidth, setPreviewWidth] = useState(410)
  const [resizeDrag, setResizeDrag] = useState<ResizeDrag | null>(null)
  const [svgExportOpen, setSvgExportOpen] = useState(false)
  const [svgFilename, setSvgFilename] = useState('paper-studio-net')
  const [exportFormat, setExportFormat] = useState<'svg' | 'pdf'>('svg')
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    paperSize: 'A4',
    orientation: 'portrait',
    marginMm: 10,
    overlapMm: 8,
  })
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState('')

  const cuboid = useMemo(() => createCuboid(dimensions), [dimensions])
  const netLayout = useMemo(
    () => createCuboidNet(dimensions, glueTabOptions),
    [dimensions, glueTabOptions],
  )
  const printLayoutResult = useMemo(() => {
    try {
      return {
        layout: computePrintLayout(netLayout.bounds, printSettings),
        error: '',
      }
    } catch (error) {
      return {
        layout: null,
        error:
          error instanceof Error
            ? error.message
            : 'PDF 미리보기를 만들 수 없습니다.',
      }
    }
  }, [netLayout, printSettings])
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

  function updateGlueTabOption(field: 'widthMm' | 'angleDeg', value: string) {
    setGlueTabDrafts((current) => ({ ...current, [field]: value }))
    const numericValue = Number(value)
    const minimum =
      field === 'widthMm' ? MIN_GLUE_TAB_WIDTH_MM : MIN_GLUE_TAB_ANGLE_DEG
    const maximum =
      field === 'widthMm' ? MAX_GLUE_TAB_WIDTH_MM : MAX_GLUE_TAB_ANGLE_DEG
    if (
      !Number.isFinite(numericValue) ||
      numericValue < minimum ||
      numericValue > maximum
    ) {
      setGlueTabErrors((current) => ({
        ...current,
        [field]: `${minimum}–${maximum}${field === 'widthMm' ? ' mm' : '°'} 범위로 입력하세요.`,
      }))
      return
    }
    setGlueTabErrors((current) => ({ ...current, [field]: undefined }))
    setGlueTabOptions((current) => ({ ...current, [field]: numericValue }))
  }

  function downloadSvg() {
    const svg = serializeNetToSvg(netLayout, svgFilename)
    const objectUrl = URL.createObjectURL(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = normalizeSvgFilename(svgFilename)
    link.click()
    URL.revokeObjectURL(objectUrl)
    setSvgExportOpen(false)
  }

  async function downloadPdf() {
    if (!printLayoutResult.layout) return
    setExportBusy(true)
    setExportError('')
    try {
      const { createTiledPdf } = await import('./export/pdf')
      const bytes = await createTiledPdf(netLayout, printSettings, svgFilename)
      const objectUrl = URL.createObjectURL(
        new Blob([bytes.slice().buffer as ArrayBuffer], {
          type: 'application/pdf',
        }),
      )
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = normalizeSvgFilename(svgFilename).replace(
        /\.svg$/i,
        '.pdf',
      )
      link.click()
      URL.revokeObjectURL(objectUrl)
      setSvgExportOpen(false)
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : 'PDF 파일을 생성하지 못했습니다.',
      )
    } finally {
      setExportBusy(false)
    }
  }

  function handleExportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (exportFormat === 'svg') downloadSvg()
    else void downloadPdf()
  }

  function updatePrintSetting<K extends keyof PrintSettings>(
    key: K,
    value: PrintSettings[K],
  ) {
    setPrintSettings((current) => ({ ...current, [key]: value }))
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
          onClick={() => setSvgExportOpen(true)}
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

            <div className="inspector-section-title inspector-section-title--tabs">
              <span>접착탭</span>
              <label className="glue-tab-toggle">
                <input
                  type="checkbox"
                  aria-label="접착탭 표시"
                  checked={glueTabOptions.enabled}
                  onChange={(event) =>
                    setGlueTabOptions((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }))
                  }
                />
                표시
              </label>
            </div>
            <div className="glue-tab-options">
              <label className="dimension-field">
                <span className="dimension-field__label">탭 너비</span>
                <span
                  className={`dimension-input-wrap${glueTabErrors.widthMm ? 'has-error' : ''}`}
                >
                  <input
                    type="number"
                    min={MIN_GLUE_TAB_WIDTH_MM}
                    max={MAX_GLUE_TAB_WIDTH_MM}
                    step="0.5"
                    aria-label="접착탭 너비 (mm)"
                    aria-invalid={Boolean(glueTabErrors.widthMm)}
                    aria-describedby={
                      glueTabErrors.widthMm ? 'glue-tab-width-error' : undefined
                    }
                    value={glueTabDrafts.widthMm}
                    disabled={!glueTabOptions.enabled}
                    onChange={(event) =>
                      updateGlueTabOption('widthMm', event.target.value)
                    }
                  />
                  <span>mm</span>
                </span>
                {glueTabErrors.widthMm && (
                  <small
                    id="glue-tab-width-error"
                    className="dimension-error"
                    role="alert"
                  >
                    {glueTabErrors.widthMm}
                  </small>
                )}
              </label>
              <label className="dimension-field">
                <span className="dimension-field__label">경사각</span>
                <span
                  className={`dimension-input-wrap${glueTabErrors.angleDeg ? 'has-error' : ''}`}
                >
                  <input
                    type="number"
                    min={MIN_GLUE_TAB_ANGLE_DEG}
                    max={MAX_GLUE_TAB_ANGLE_DEG}
                    step="1"
                    aria-label="접착탭 경사각 (도)"
                    aria-invalid={Boolean(glueTabErrors.angleDeg)}
                    aria-describedby={
                      glueTabErrors.angleDeg
                        ? 'glue-tab-angle-error'
                        : undefined
                    }
                    value={glueTabDrafts.angleDeg}
                    disabled={!glueTabOptions.enabled}
                    onChange={(event) =>
                      updateGlueTabOption('angleDeg', event.target.value)
                    }
                  />
                  <span>°</span>
                </span>
                {glueTabErrors.angleDeg && (
                  <small
                    id="glue-tab-angle-error"
                    className="dimension-error"
                    role="alert"
                  >
                    {glueTabErrors.angleDeg}
                  </small>
                )}
              </label>
            </div>
            {glueTabOptions.enabled &&
              netLayout.tabInterferences.length > 0 && (
                <p className="glue-tab-warning" role="status">
                  접착탭이 서로 겹칩니다. 너비를 줄여주세요 (
                  {netLayout.tabInterferences.length}곳)
                </p>
              )}

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

      {svgExportOpen && (
        <div className="export-dialog-backdrop">
          <form
            className="export-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="svg-export-title"
            onSubmit={handleExportSubmit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSvgExportOpen(false)
            }}
          >
            <div className="export-dialog__heading">
              <div>
                <span className="inspector-eyebrow">EXPORT</span>
                <h2 id="svg-export-title">도면 내보내기</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="내보내기 닫기"
                onClick={() => setSvgExportOpen(false)}
              >
                ×
              </button>
            </div>
            <label className="export-dialog__field">
              파일 형식
              <select
                aria-label="파일 형식"
                value={exportFormat}
                onChange={(event) => {
                  setExportFormat(event.target.value as 'svg' | 'pdf')
                  setExportError('')
                }}
              >
                <option value="svg">SVG · 벡터 도면</option>
                <option value="pdf">PDF · 인쇄용 페이지</option>
              </select>
            </label>
            <label className="export-dialog__field">
              파일 이름
              <input
                autoFocus
                aria-label={
                  exportFormat === 'svg' ? 'SVG 파일 이름' : 'PDF 파일 이름'
                }
                value={svgFilename}
                onChange={(event) => setSvgFilename(event.target.value)}
              />
            </label>
            {exportFormat === 'svg' ? (
              <p className="export-dialog__note">
                SVG 도면은 mm 단위 실제 크기로 생성됩니다. 인쇄할 때 배율을
                100%로 설정하세요.
              </p>
            ) : (
              <>
                <div className="pdf-print-settings">
                  <label className="export-dialog__field">
                    용지 크기
                    <select
                      aria-label="PDF 용지 크기"
                      value={printSettings.paperSize}
                      onChange={(event) =>
                        updatePrintSetting(
                          'paperSize',
                          event.target.value as PaperSize,
                        )
                      }
                    >
                      <option value="A4">A4</option>
                      <option value="A3">A3</option>
                    </select>
                  </label>
                  <label className="export-dialog__field">
                    방향
                    <select
                      aria-label="PDF 방향"
                      value={printSettings.orientation}
                      onChange={(event) =>
                        updatePrintSetting(
                          'orientation',
                          event.target.value as PageOrientation,
                        )
                      }
                    >
                      <option value="portrait">세로</option>
                      <option value="landscape">가로</option>
                    </select>
                  </label>
                  <label className="export-dialog__field">
                    여백 (mm)
                    <input
                      type="number"
                      aria-label="PDF 여백 (mm)"
                      min="2"
                      max="30"
                      step="1"
                      value={printSettings.marginMm}
                      onChange={(event) =>
                        updatePrintSetting(
                          'marginMm',
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                  <label className="export-dialog__field">
                    페이지 겹침 (mm)
                    <input
                      type="number"
                      aria-label="페이지 겹침 (mm)"
                      min="2"
                      max="20"
                      step="1"
                      value={printSettings.overlapMm}
                      onChange={(event) =>
                        updatePrintSetting(
                          'overlapMm',
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                </div>
                {printLayoutResult.layout ? (
                  <>
                    <p className="print-preview-summary" role="status">
                      {printLayoutResult.layout.pageWidthMm} ×{' '}
                      {printLayoutResult.layout.pageHeightMm} mm ·{' '}
                      {printLayoutResult.layout.tiles.length}페이지 · 인쇄 가능
                      영역 {printLayoutResult.layout.printableWidthMm} ×{' '}
                      {printLayoutResult.layout.printableHeightMm} mm
                    </p>
                    <PrintPagePreviews
                      net={netLayout}
                      layout={printLayoutResult.layout}
                    />
                  </>
                ) : (
                  <p className="glue-tab-warning" role="alert">
                    {printLayoutResult.error}
                  </p>
                )}
                <p className="export-dialog__note">
                  출력 창에서 “실제 크기” 또는 100%를 선택하고 페이지 맞춤,
                  축소, 용지에 맞춤을 끄세요. PDF도 프린터 설정에 따라 실측이
                  달라질 수 있습니다.
                </p>
              </>
            )}
            {exportError && (
              <p className="dimension-error" role="alert">
                {exportError}
              </p>
            )}
            <div className="export-dialog__actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSvgExportOpen(false)}
              >
                취소
              </button>
              <button
                className="export-button"
                type="submit"
                disabled={
                  exportBusy ||
                  (exportFormat === 'pdf' && !printLayoutResult.layout)
                }
              >
                <Download size={15} />{' '}
                {exportBusy
                  ? 'PDF 생성 중…'
                  : exportFormat === 'svg'
                    ? 'SVG 다운로드'
                    : 'PDF 다운로드'}
              </button>
            </div>
          </form>
        </div>
      )}

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
