import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
  FolderOpen,
  FolderTree,
  Grid2X2,
  Layers3,
  MoreHorizontal,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Camera,
  Redo2,
  Ruler,
  Settings2,
  Save,
  Undo2,
} from 'lucide-react'
import { CuboidNetCanvas } from './canvas/CuboidNetCanvas'
import { PolyhedronNetCanvas } from './canvas/PolyhedronNetCanvas'
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
  createRegularPolyhedron,
  unfoldPolyhedron,
} from './geometry'
import {
  DEFAULT_FACE_MATERIAL,
  MATERIAL_PRESETS,
  setFaceMaterial,
} from './materials/materials'
import type { FaceMaterial, FaceTexture } from './materials/materials'
import type {
  CuboidDimensions,
  FaceId,
  GlueTabOptions,
  RegularPolyhedronKind,
} from './geometry'
import {
  normalizeSvgFilename,
  serializeNetToSvg,
  serializeUnfoldedNetToSvg,
} from './export/svg'
import {
  createCuboidFoldGraph,
  createPolyhedronFoldGraph,
  createIdealSurfaceCollisionEngine,
  solveFoldPoses,
} from './folding'
import {
  computePrintLayout,
  type PageOrientation,
  type PaperSize,
  type PrintSettings,
} from './export/print-layout'
import { PrintPagePreviews } from './export/PrintPagePreviews'
import { createPrintableNet } from './export/printable-net'
import { runPrintPreflight } from './export/preflight'
import {
  createCorrectedPrintableNet,
  scaleFaceMaterialOffsets,
} from './export/precision-export'
import {
  CALIBRATION_REFERENCE_LENGTHS,
  calculateCalibrationResult,
} from './export/calibration'
import type { CalibrationReferenceLength } from './export/calibration'
import { PrinterCalibrationPanel } from './calibration/PrinterCalibrationPanel'
import type { PrinterCorrectionSelection } from './calibration/PrinterCalibrationPanel'
import {
  readCalibrationMeasurements,
  removeCalibrationMeasurement,
  saveCalibrationMeasurement,
} from './persistence/calibration-storage'
import type { StoredCalibrationMeasurement } from './persistence/calibration-storage'
import { createAssemblyGuide } from './assembly/guide'
import {
  createProjectDocument,
  parseProject,
  serializeProject,
} from './project/project-file'

const ThreeCuboidPreview = lazy(() =>
  import('./preview/ThreeCuboidPreview').then((module) => ({
    default: module.ThreeCuboidPreview,
  })),
)
const ThreePolyhedronPreview = lazy(() =>
  import('./preview/ThreePolyhedronPreview').then((module) => ({
    default: module.ThreePolyhedronPreview,
  })),
)

const collisionEngine = createIdealSurfaceCollisionEngine()

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
  const [solidKind, setSolidKind] = useState<'cuboid' | RegularPolyhedronKind>(
    'cuboid',
  )
  const [projectName, setProjectName] = useState('새 프로젝트')
  const [projectError, setProjectError] = useState('')
  const projectFileInput = useRef<HTMLInputElement>(null)
  const [edgeLengthMm, setEdgeLengthMm] = useState(100)
  const [edgeLengthDraft, setEdgeLengthDraft] = useState('100')
  const [edgeLengthError, setEdgeLengthError] = useState('')
  const [dimensions, setDimensions] = useState(DEFAULT_DIMENSIONS)
  const [dimensionDrafts, setDimensionDrafts] = useState({
    widthMm: '100',
    depthMm: '80',
    heightMm: '60',
  })
  const [dimensionErrors, setDimensionErrors] = useState<
    Partial<Record<keyof CuboidDimensions, string>>
  >({})
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>('front')
  const [faceMaterials, setFaceMaterials] = useState<
    Record<string, FaceMaterial>
  >({})
  const [textureError, setTextureError] = useState('')
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [customFoldEdgeIds, setCustomFoldEdgeIds] = useState<string[] | null>(
    null,
  )
  const [draftFoldEdgeIds, setDraftFoldEdgeIds] = useState<string[] | null>(
    null,
  )
  const [foldTreeError, setFoldTreeError] = useState('')
  const [foldTreeHistory, setFoldTreeHistory] = useState<
    Array<string[] | null>
  >([])
  const [foldTreeHistoryIndex, setFoldTreeHistoryIndex] = useState(-1)
  const [foldProgress, setFoldProgress] = useState(1)
  const [assemblyStepIndex, setAssemblyStepIndex] = useState(0)
  const [assemblyGuideActive, setAssemblyGuideActive] = useState(false)
  const foldProgressRef = useRef(1)
  const [foldPlaying, setFoldPlaying] = useState(false)
  const [foldSpeed, setFoldSpeed] = useState(1)
  const [cameraResetToken, setCameraResetToken] = useState(0)
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
  const [exportFormat, setExportFormat] = useState<'svg' | 'pdf' | 'guide-pdf'>(
    'svg',
  )
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    paperSize: 'A4',
    orientation: 'portrait',
    marginMm: 10,
    overlapMm: 8,
    showCutLines: true,
    showFoldLines: true,
    showAssemblyNumbers: true,
  })
  const [calibrationMeasurements, setCalibrationMeasurements] = useState<
    StoredCalibrationMeasurement[]
  >(() => readCalibrationMeasurements())
  const [calibrationDrafts, setCalibrationDrafts] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      readCalibrationMeasurements().map((measurement) => [
        `${measurement.paperSize}-${measurement.targetMm}`,
        String(measurement.measuredMm),
      ]),
    ),
  )
  const [calibrationStorageError, setCalibrationStorageError] = useState('')
  const [printerCorrection, setPrinterCorrection] =
    useState<PrinterCorrectionSelection | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportError, setExportError] = useState('')
  const handlePrinterCorrectionChange = useCallback(
    (selection: PrinterCorrectionSelection | null) =>
      setPrinterCorrection(selection),
    [],
  )

  const cuboid = useMemo(() => createCuboid(dimensions), [dimensions])
  const netLayout = useMemo(
    () => createCuboidNet(dimensions, glueTabOptions),
    [dimensions, glueTabOptions],
  )
  const genericMesh = useMemo(
    () =>
      solidKind === 'cuboid'
        ? null
        : createRegularPolyhedron(solidKind, edgeLengthMm),
    [edgeLengthMm, solidKind],
  )
  const genericUnfolding = useMemo(
    () =>
      genericMesh
        ? unfoldPolyhedron(
            genericMesh,
            customFoldEdgeIds ? { foldEdgeIds: customFoldEdgeIds } : {},
          )
        : null,
    [customFoldEdgeIds, genericMesh],
  )
  const genericFoldGraph = useMemo(() => {
    if (!genericMesh || !genericUnfolding?.success) return null
    try {
      return createPolyhedronFoldGraph(genericUnfolding.layout, genericMesh)
    } catch {
      return null
    }
  }, [genericMesh, genericUnfolding])
  const cuboidFoldGraph = useMemo(
    () => createCuboidFoldGraph(netLayout, cuboid),
    [cuboid, netLayout],
  )
  const assemblyGuide = useMemo(() => {
    const graph = solidKind === 'cuboid' ? cuboidFoldGraph : genericFoldGraph
    if (!graph) return null
    try {
      return createAssemblyGuide(graph)
    } catch {
      return null
    }
  }, [cuboidFoldGraph, genericFoldGraph, solidKind])
  const assemblyStep =
    assemblyGuide && assemblyGuideActive
      ? assemblyGuide.steps[assemblyStepIndex]
      : undefined
  const assemblyHingeProgress = useMemo(() => {
    if (!assemblyGuideActive || !assemblyGuide) return undefined
    return Object.fromEntries(
      assemblyGuide.steps.map((step) => [
        step.edgeId,
        step.index < assemblyStepIndex
          ? 1
          : step.index === assemblyStepIndex
            ? foldProgress
            : 0,
      ]),
    )
  }, [assemblyGuide, assemblyGuideActive, assemblyStepIndex, foldProgress])
  const assemblyHighlightFaceId = assemblyStep?.faceId ?? null
  const genericPrintableNet = useMemo(
    () =>
      genericUnfolding?.success
        ? createPrintableNet(genericUnfolding.layout, glueTabOptions)
        : null,
    [genericUnfolding, glueTabOptions],
  )
  const printableNet = useMemo(
    () => genericPrintableNet ?? createPrintableNet(netLayout),
    [genericPrintableNet, netLayout],
  )
  const calibratedPrintableNet = useMemo(
    () =>
      printerCorrection
        ? createCorrectedPrintableNet(printableNet, printerCorrection)
        : printableNet,
    [printableNet, printerCorrection],
  )
  const calibratedFaceMaterials = useMemo(
    () =>
      printerCorrection
        ? scaleFaceMaterialOffsets(faceMaterials, printerCorrection)
        : faceMaterials,
    [faceMaterials, printerCorrection],
  )
  const genericIntersections = useMemo(() => {
    if (
      !genericMesh ||
      !genericUnfolding?.success ||
      !genericFoldGraph ||
      foldProgress <= 0.001
    ) {
      return []
    }
    try {
      return collisionEngine.inspectFolded(
        genericMesh,
        genericUnfolding.layout,
        solveFoldPoses(genericFoldGraph, foldProgress),
      )
    } catch {
      return []
    }
  }, [foldProgress, genericFoldGraph, genericMesh, genericUnfolding])
  const printLayoutResult = useMemo(() => {
    try {
      return {
        layout: computePrintLayout(
          calibratedPrintableNet.bounds,
          printSettings,
        ),
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
  }, [calibratedPrintableNet, printSettings])
  const preflightReport = useMemo(
    () =>
      printLayoutResult.layout
        ? runPrintPreflight(
            calibratedPrintableNet,
            printLayoutResult.layout,
            calibratedFaceMaterials,
          )
        : null,
    [calibratedFaceMaterials, calibratedPrintableNet, printLayoutResult.layout],
  )
  const selectedFace = cuboid.faces.find((face) => face.id === selectedFaceId)
  const selectedGenericFace = genericUnfolding?.success
    ? genericUnfolding.layout.faces.find((face) => face.id === selectedFaceId)
    : undefined
  const selectedGenericEdge = genericUnfolding?.success
    ? genericUnfolding.layout.edges.find((edge) => edge.id === selectedEdgeId)
    : undefined
  const activeTabInterferences =
    genericPrintableNet?.tabInterferences ?? netLayout.tabInterferences
  const glueTabEdges = useMemo(() => {
    const edges = genericUnfolding?.success
      ? genericUnfolding.layout.edges
      : netLayout.edges
    const seenConnections = new Set<string>()
    return edges.filter((edge) => {
      if (edge.kind !== 'cut' || edge.adjacentFaceIds.length !== 2) return false
      const key = [...edge.adjacentFaceIds].sort().join('|')
      if (seenConnections.has(key)) return false
      seenConnections.add(key)
      return true
    })
  }, [genericUnfolding, netLayout.edges])
  const displayedFoldEdgeIds =
    draftFoldEdgeIds ??
    (genericUnfolding?.success ? genericUnfolding.layout.foldEdgeIds : [])
  const solidLabel =
    solidKind === 'cuboid'
      ? '직육면체'
      : solidKind === 'tetrahedron'
        ? '정사면체'
        : solidKind === 'cube'
          ? '정육면체'
          : '정팔면체'
  const selectedFaceMaterial = selectedFaceId
    ? (faceMaterials[selectedFaceId] ?? DEFAULT_FACE_MATERIAL)
    : null

  function startAssemblyGuide() {
    if (!assemblyGuide) return
    setAssemblyGuideActive(true)
    setAssemblyStepIndex(0)
    setFoldPlaying(false)
    foldProgressRef.current = 0
    setFoldProgress(0)
  }

  function moveAssemblyGuidePrevious() {
    if (!assemblyGuide) return
    setFoldPlaying(false)
    if (foldProgress > 0) {
      foldProgressRef.current = 0
      setFoldProgress(0)
    } else if (assemblyStepIndex > 0) {
      setAssemblyStepIndex((index) => index - 1)
      foldProgressRef.current = 1
      setFoldProgress(1)
    }
  }

  function moveAssemblyGuideNext() {
    if (!assemblyGuide) return
    if (assemblyStepIndex >= assemblyGuide.steps.length) return
    if (foldProgress < 1) {
      setFoldPlaying(true)
      return
    }
    setAssemblyStepIndex((index) => index + 1)
    foldProgressRef.current = 0
    setFoldProgress(0)
  }

  useEffect(() => {
    if (!foldPlaying) return
    let frame = 0
    let previous = 0
    const advance = (now: number) => {
      if (previous === 0) previous = now
      const delta = now - previous
      previous = now
      const next = Math.min(
        1,
        foldProgressRef.current + (delta / 4_000) * foldSpeed,
      )
      foldProgressRef.current = next
      setFoldProgress(next)
      if (next >= 1) {
        setFoldPlaying(false)
        return
      }
      frame = window.requestAnimationFrame(advance)
    }
    frame = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frame)
  }, [foldPlaying, foldSpeed])

  useEffect(() => {
    foldProgressRef.current = foldProgress
  }, [foldProgress])

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

  function updateEdgeLength(value: string) {
    setEdgeLengthDraft(value)
    const numeric = Number(value)
    const validation = validateCuboidDimensions({
      widthMm: numeric,
      depthMm: numeric,
      heightMm: numeric,
    })
    if (!validation.valid) {
      setEdgeLengthError(
        `모서리 길이는 ${MIN_DIMENSION_MM}–${MAX_DIMENSION_MM.toLocaleString()} mm 범위여야 합니다.`,
      )
      return
    }
    setEdgeLengthError('')
    setEdgeLengthMm(numeric)
  }

  function commitFoldTree(nextFoldEdgeIds: string[] | null) {
    const prefix =
      foldTreeHistoryIndex >= 0
        ? foldTreeHistory.slice(0, foldTreeHistoryIndex + 1)
        : [customFoldEdgeIds]
    const nextHistory = [...prefix, nextFoldEdgeIds]
    setFoldTreeHistory(nextHistory)
    setFoldTreeHistoryIndex(nextHistory.length - 1)
    setCustomFoldEdgeIds(nextFoldEdgeIds)
    setDraftFoldEdgeIds(null)
    setFoldTreeError('')
    foldProgressRef.current = 0
    setFoldProgress(0)
  }

  function toggleFoldEdge(edgeId: string) {
    if (!genericMesh || !genericUnfolding?.success) return
    const current =
      draftFoldEdgeIds ??
      customFoldEdgeIds ??
      genericUnfolding.layout.foldEdgeIds
    const candidate = current.includes(edgeId)
      ? current.filter((id) => id !== edgeId)
      : [...current, edgeId]
    setSelectedEdgeId(edgeId)
    setDraftFoldEdgeIds(candidate)
    const requiredFoldCount = genericMesh.faces.length - 1
    if (candidate.length !== requiredFoldCount) {
      setFoldTreeError(
        `전개 트리를 검사하려면 접힘선을 ${requiredFoldCount}개 선택해야 합니다. 현재 ${candidate.length}개입니다.`,
      )
      return
    }
    const result = unfoldPolyhedron(genericMesh, {
      foldEdgeIds: candidate,
    })
    if (!result.success) {
      const messages: Record<string, string> = {
        'duplicate-fold-edge': '같은 모서리가 접힘선에 중복되었습니다.',
        'unknown-or-boundary-fold-edge':
          '접힘선은 두 면을 공유하는 유효한 모서리여야 합니다.',
        'fold-edge-count-must-equal-face-count-minus-one':
          '접힘선 수가 면 수에 맞지 않습니다.',
        'fold-edges-do-not-connect-all-faces':
          '접힘선 그래프가 모든 면을 연결하지 않습니다.',
        'selected-fold-tree-overlaps': `선택한 전개 트리에서 ${result.collisions.length}쌍의 면이 겹칩니다.`,
        'selected-fold-tree-could-not-be-unfolded':
          '선택한 전개 트리를 평면에 배치할 수 없습니다.',
      }
      setFoldTreeError(
        result.issues.map((issue) => messages[issue] ?? issue).join(' '),
      )
      return
    }
    commitFoldTree(candidate)
  }

  const restoreFoldTreeAt = useCallback(
    (index: number) => {
      if (index < 0 || index >= foldTreeHistory.length) return
      setFoldTreeHistoryIndex(index)
      setCustomFoldEdgeIds(foldTreeHistory[index])
      setDraftFoldEdgeIds(null)
      setFoldTreeError('')
      foldProgressRef.current = 0
      setFoldProgress(0)
    },
    [foldTreeHistory],
  )

  const undoFoldTree = useCallback(() => {
    if (foldTreeHistoryIndex > 0) {
      restoreFoldTreeAt(foldTreeHistoryIndex - 1)
    }
  }, [foldTreeHistoryIndex, restoreFoldTreeAt])

  const redoFoldTree = useCallback(() => {
    if (foldTreeHistoryIndex >= 0) {
      restoreFoldTreeAt(foldTreeHistoryIndex + 1)
    }
  }, [foldTreeHistoryIndex, restoreFoldTreeAt])

  function resetFoldTree() {
    if (!genericMesh || !genericUnfolding?.success) return
    if (customFoldEdgeIds === null && draftFoldEdgeIds === null) return
    commitFoldTree(null)
  }

  useEffect(() => {
    function handleHistoryShortcut(event: KeyboardEvent) {
      if (solidKind === 'cuboid' || !(event.metaKey || event.ctrlKey)) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return
      }
      if (event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) redoFoldTree()
      else undoFoldTree()
    }
    window.addEventListener('keydown', handleHistoryShortcut)
    return () => window.removeEventListener('keydown', handleHistoryShortcut)
  }, [redoFoldTree, solidKind, undoFoldTree])

  function updateSelectedMaterial(next: FaceMaterial) {
    if (!selectedFaceId) return
    setFaceMaterials((current) =>
      setFaceMaterial(current, selectedFaceId, next),
    )
  }

  function updateSelectedTexture(
    field: keyof Omit<FaceTexture, 'dataUrl'>,
    value: string,
  ) {
    if (!selectedFaceMaterial?.texture) return
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return
    updateSelectedMaterial({
      ...selectedFaceMaterial,
      texture: { ...selectedFaceMaterial.texture, [field]: numericValue },
    })
  }

  function loadLocalTexture(file?: File) {
    if (!file || !selectedFaceMaterial) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setTextureError('PNG, JPEG 또는 WebP 이미지를 선택하세요.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setTextureError('이미지 파일은 4 MB 이하여야 합니다.')
      return
    }
    const reader = new FileReader()
    reader.onerror = () => setTextureError('이미지를 읽지 못했습니다.')
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      updateSelectedMaterial({
        ...selectedFaceMaterial,
        texture: {
          dataUrl: reader.result,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          rotationDeg: 0,
        },
      })
      setTextureError('')
    }
    reader.readAsDataURL(file)
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
    const svg = genericUnfolding?.success
      ? serializeUnfoldedNetToSvg(
          genericUnfolding.layout,
          svgFilename,
          genericPrintableNet?.glueTabs,
          faceMaterials,
        )
      : serializeNetToSvg(netLayout, svgFilename, faceMaterials)
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
      const bytes = await createTiledPdf(
        printableNet,
        printSettings,
        svgFilename,
        {
          faceMaterials,
          showCutLines: printSettings.showCutLines,
          showFoldLines: printSettings.showFoldLines,
          showAssemblyNumbers: printSettings.showAssemblyNumbers,
          calibration: printerCorrection ?? undefined,
        },
      )
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

  async function downloadAssemblyGuidePdf() {
    if (!assemblyGuide) return
    setExportBusy(true)
    setExportError('')
    try {
      const { createAssemblyGuidePdf } =
        await import('./export/assembly-guide-pdf')
      const bytes = await createAssemblyGuidePdf(assemblyGuide, svgFilename)
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
          : '조립 설명서 PDF를 만들지 못했습니다.',
      )
    } finally {
      setExportBusy(false)
    }
  }

  function handleExportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (exportFormat === 'svg') downloadSvg()
    else if (exportFormat === 'guide-pdf') void downloadAssemblyGuidePdf()
    else void downloadPdf()
  }

  function saveProjectFile() {
    try {
      const project = createProjectDocument({
        name: projectName,
        solidKind,
        dimensions,
        edgeLengthMm,
        glueTabOptions,
        customFoldEdgeIds,
        selectedFaceId,
        selectedEdgeId,
        foldProgress,
        printSettings,
        faceMaterials,
        assemblyStepIndex,
        assemblyGuideActive,
      })
      const objectUrl = URL.createObjectURL(
        new Blob([serializeProject(project)], {
          type: 'application/json;charset=utf-8',
        }),
      )
      const link = document.createElement('a')
      link.href = objectUrl
      const safeName = project.name.replace(/[<>:"/\\|?*]/g, '-').trim()
      link.download = `${safeName || 'paper-studio'}.paperstudio.json`
      link.click()
      URL.revokeObjectURL(objectUrl)
      setProjectError('')
    } catch (error) {
      setProjectError(
        error instanceof Error
          ? error.message
          : '프로젝트를 저장하지 못했습니다.',
      )
    }
  }

  async function loadProjectFile(file: File) {
    try {
      const project = parseProject(await file.text())
      let faceIds: string[]
      let edgeIds: string[]
      if (project.solidKind === 'cuboid') {
        const model = createCuboid(project.dimensions)
        faceIds = model.faces.map(({ id }) => id)
        edgeIds = model.edges.map(({ id }) => id)
      } else {
        const mesh = createRegularPolyhedron(
          project.solidKind,
          project.edgeLengthMm,
        )
        const unfolding = unfoldPolyhedron(
          mesh,
          project.customFoldEdgeIds
            ? { foldEdgeIds: project.customFoldEdgeIds }
            : {},
        )
        if (!unfolding.success) {
          throw new RangeError(
            `프로젝트 전개 트리가 유효하지 않습니다: ${unfolding.issues.join(', ')}`,
          )
        }
        faceIds = unfolding.layout.faces.map(({ id }) => id)
        edgeIds = unfolding.layout.edges.map(({ id }) => id)
      }
      if (
        (project.selectedFaceId && !faceIds.includes(project.selectedFaceId)) ||
        (project.selectedEdgeId && !edgeIds.includes(project.selectedEdgeId))
      ) {
        throw new RangeError(
          '프로젝트 선택 상태가 현재 구조와 일치하지 않습니다.',
        )
      }

      setProjectName(project.name)
      setSolidKind(project.solidKind)
      setDimensions(project.dimensions)
      setDimensionDrafts({
        widthMm: String(project.dimensions.widthMm),
        depthMm: String(project.dimensions.depthMm),
        heightMm: String(project.dimensions.heightMm),
      })
      setDimensionErrors({})
      setEdgeLengthMm(project.edgeLengthMm)
      setEdgeLengthDraft(String(project.edgeLengthMm))
      setEdgeLengthError('')
      setGlueTabOptions(project.glueTabOptions)
      setGlueTabDrafts({
        widthMm: String(project.glueTabOptions.widthMm),
        angleDeg: String(project.glueTabOptions.angleDeg),
      })
      setGlueTabErrors({})
      setCustomFoldEdgeIds(project.customFoldEdgeIds)
      setDraftFoldEdgeIds(null)
      setFoldTreeError('')
      setFoldTreeHistory([])
      setFoldTreeHistoryIndex(-1)
      setSelectedFaceId(project.selectedFaceId)
      setSelectedEdgeId(project.selectedEdgeId)
      setPrintSettings(project.printSettings)
      setFaceMaterials(project.faceMaterials)
      setAssemblyStepIndex(
        Math.min(project.assemblyStepIndex, Math.max(0, faceIds.length - 1)),
      )
      setAssemblyGuideActive(project.assemblyGuideActive)
      setFoldPlaying(false)
      foldProgressRef.current = project.foldProgress
      setFoldProgress(project.foldProgress)
      setProjectError('')
    } catch (error) {
      setProjectError(
        error instanceof Error
          ? error.message
          : '프로젝트 파일을 불러오지 못했습니다.',
      )
    }
  }

  function updatePrintSetting<K extends keyof PrintSettings>(
    key: K,
    value: PrintSettings[K],
  ) {
    setPrintSettings((current) => ({ ...current, [key]: value }))
  }

  function updateCalibrationMeasurement(
    targetMm: CalibrationReferenceLength,
    value: string,
  ) {
    const paperSize = printSettings.paperSize
    const key = `${paperSize}-${targetMm}`
    setCalibrationDrafts((current) => ({ ...current, [key]: value }))
    if (!value.trim()) {
      const removed = removeCalibrationMeasurement(paperSize, targetMm)
      setCalibrationStorageError(
        removed
          ? ''
          : '브라우저 저장소에 접근할 수 없어 교정 기록을 지우지 못했습니다.',
      )
      setCalibrationMeasurements((current) =>
        current.filter(
          (item) => item.paperSize !== paperSize || item.targetMm !== targetMm,
        ),
      )
      return
    }
    const measuredMm = Number(value)
    if (!Number.isFinite(measuredMm) || measuredMm <= 0) return
    const measurement = {
      paperSize,
      targetMm,
      measuredMm,
      savedAt: new Date().toISOString(),
    }
    const saved = saveCalibrationMeasurement(measurement)
    setCalibrationStorageError(
      saved
        ? ''
        : '브라우저 저장소에 접근할 수 없어 교정 기록을 저장하지 못했습니다.',
    )
    setCalibrationMeasurements((current) => [
      ...current.filter(
        (item) => item.paperSize !== paperSize || item.targetMm !== targetMm,
      ),
      measurement,
    ])
  }

  const workspaceStyle = {
    '--sidebar-width': `${sidebarWidth}px`,
    '--preview-width': `${previewWidth}px`,
  } as CSSProperties

  return (
    <div className="studio-shell" style={workspaceStyle}>
      <header className="studio-topbar">
        <a className="studio-brand" href="/" aria-label="Paper Studio 홈">
          <span className="studio-brand__mark">
            <Box size={17} strokeWidth={1.8} />
          </span>
          <span>
            paper<span className="studio-brand__dot">.</span>studio
          </span>
        </a>
        <div className="topbar-divider" />
        <div className="document-title">
          <span className="document-title__eyebrow">로컬 프로젝트</span>
          <strong>{solidLabel} 설계</strong>
          <ChevronDown size={13} />
        </div>
        <div className="topbar-spacer" />
        <span className="local-state">
          <span /> 브라우저에서 작업 중
        </span>
        <button
          className="icon-button topbar-icon project-file-action"
          type="button"
          aria-label="프로젝트 저장"
          onClick={saveProjectFile}
        >
          <Save size={16} />
        </button>
        <button
          className="icon-button topbar-icon project-file-action"
          type="button"
          aria-label="프로젝트 열기"
          onClick={() => projectFileInput.current?.click()}
        >
          <FolderOpen size={16} />
        </button>
        <input
          ref={projectFileInput}
          type="file"
          hidden
          accept=".paperstudio.json,application/json"
          aria-label="프로젝트 파일"
          onChange={(event) => {
            const [file] = event.currentTarget.files ?? []
            event.currentTarget.value = ''
            if (file) void loadProjectFile(file)
          }}
        />
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
              <strong>{projectName}</strong>
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
            <span>{solidKind === 'cuboid' ? '직육면체' : '다면체'}</span>
            <span className="object-row__dot" />
          </button>
          <label className="polyhedron-selector">
            <span>구조 종류</span>
            <select
              aria-label="다면체 종류"
              value={solidKind}
              onChange={(event) => {
                const nextKind = event.target.value as
                  'cuboid' | RegularPolyhedronKind
                setSolidKind(nextKind)
                setSelectedEdgeId(null)
                setCustomFoldEdgeIds(null)
                setDraftFoldEdgeIds(null)
                setFoldTreeError('')
                setFoldTreeHistory([])
                setFoldTreeHistoryIndex(-1)
                setSelectedFaceId(
                  nextKind === 'cuboid'
                    ? 'front'
                    : (createRegularPolyhedron(nextKind, edgeLengthMm).faces[0]
                        ?.id ?? null),
                )
                if (nextKind !== 'cuboid') setExportFormat('svg')
                setFoldPlaying(false)
                foldProgressRef.current = 0
                setFoldProgress(0)
              }}
            >
              <option value="cuboid">직육면체</option>
              <option value="tetrahedron">정사면체</option>
              <option value="cube">정육면체</option>
              <option value="octahedron">정팔면체</option>
            </select>
          </label>

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
              <span className="subtle-label">
                {solidKind === 'cuboid' ? 'A4 · 세로' : '1:1 · mm'}
              </span>
              {solidKind !== 'cuboid' && (
                <span className="subtle-label net-edit-hint">
                  모서리를 선택해 재단선/접힘선 전환 · Ctrl+Z 취소
                </span>
              )}
            </div>
            <div className="panel-toolbar__actions">
              {selectedGenericEdge && (
                <span className="net-selected-edge" aria-live="polite">
                  {displayedFoldEdgeIds.includes(selectedGenericEdge.id)
                    ? '접힘선'
                    : '재단선'}{' '}
                  ·{' '}
                  {Math.hypot(
                    selectedGenericEdge.end.x - selectedGenericEdge.start.x,
                    selectedGenericEdge.end.y - selectedGenericEdge.start.y,
                  ).toFixed(1)}{' '}
                  mm
                </span>
              )}
              <span className="legend-item">
                <i className="legend-line legend-line--cut" /> 재단선
              </span>
              <span className="legend-item">
                <i className="legend-line legend-line--fold" /> 접힘선
              </span>
            </div>
          </div>
          <div className="net-panel__viewport">
            {solidKind === 'cuboid' ? (
              <CuboidNetCanvas
                layout={netLayout}
                faceMaterials={faceMaterials}
                selectedFaceId={selectedFaceId as FaceId | null}
                assemblyFaceId={assemblyHighlightFaceId}
                onFaceSelect={setSelectedFaceId}
              />
            ) : genericUnfolding?.success ? (
              <PolyhedronNetCanvas
                layout={genericUnfolding.layout}
                faceMaterials={faceMaterials}
                selectedFaceId={selectedFaceId}
                assemblyFaceId={assemblyHighlightFaceId}
                onFaceSelect={setSelectedFaceId}
                foldEdgeIds={displayedFoldEdgeIds}
                selectedEdgeId={selectedEdgeId}
                onEdgeToggle={toggleFoldEdge}
                onUndo={undoFoldTree}
                onRedo={redoFoldTree}
                onReset={resetFoldTree}
                canUndo={foldTreeHistoryIndex > 0}
                canRedo={
                  foldTreeHistoryIndex >= 0 &&
                  foldTreeHistoryIndex < foldTreeHistory.length - 1
                }
              />
            ) : (
              <div className="preview-error" role="alert">
                전개도를 만들 수 없습니다. {genericUnfolding?.issues.join(', ')}
              </div>
            )}
          </div>
          {solidKind !== 'cuboid' && foldTreeError && (
            <p className="net-edit-error" role="alert">
              {foldTreeError}
            </p>
          )}
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
            <div className="folding-controls" aria-label="접힘 시뮬레이션 조작">
              <button
                type="button"
                className="icon-button folding-controls__action"
                aria-label={foldPlaying ? '접힘 일시정지' : '접힘 재생'}
                onClick={() => {
                  if (foldProgress >= 1) {
                    foldProgressRef.current = 0
                    setFoldProgress(0)
                  }
                  setFoldPlaying((playing) => !playing)
                }}
              >
                {foldPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                type="button"
                className="icon-button folding-controls__action"
                aria-label="접힘 처음으로"
                onClick={() => {
                  setFoldPlaying(false)
                  foldProgressRef.current = 0
                  setFoldProgress(0)
                }}
              >
                <RotateCcw size={14} />
              </button>
              <input
                className="folding-controls__progress"
                type="range"
                min="0"
                max="1"
                step="0.001"
                aria-label="접힘 진행률"
                value={foldProgress}
                onChange={(event) => {
                  setFoldPlaying(false)
                  const next = Number(event.target.value)
                  foldProgressRef.current = next
                  setFoldProgress(next)
                }}
              />
              <span className="folding-controls__percent" aria-live="polite">
                {Math.round(foldProgress * 100)}%
              </span>
              <label className="folding-controls__speed">
                <span className="sr-only">재생 속도</span>
                <select
                  aria-label="재생 속도"
                  value={foldSpeed}
                  onChange={(event) => setFoldSpeed(Number(event.target.value))}
                >
                  <option value="0.5">0.5×</option>
                  <option value="1">1×</option>
                  <option value="2">2×</option>
                </select>
              </label>
              <button
                type="button"
                className="icon-button folding-controls__action"
                aria-label="카메라 초기화"
                onClick={() => setCameraResetToken((token) => token + 1)}
              >
                <Camera size={14} />
              </button>
            </div>
            <Suspense
              fallback={<div className="preview-loading">3D 모델 준비 중…</div>}
            >
              {solidKind === 'cuboid' ? (
                <ThreeCuboidPreview
                  cuboid={cuboid}
                  netLayout={netLayout}
                  faceMaterials={faceMaterials}
                  foldProgress={assemblyGuideActive ? 1 : foldProgress}
                  hingeProgressById={assemblyHingeProgress}
                  selectedFaceId={selectedFaceId as FaceId | null}
                  onFaceSelect={setSelectedFaceId}
                  cameraResetToken={cameraResetToken}
                />
              ) : genericMesh &&
                genericUnfolding?.success &&
                genericFoldGraph ? (
                <ThreePolyhedronPreview
                  mesh={genericMesh}
                  layout={genericUnfolding.layout}
                  faceMaterials={faceMaterials}
                  foldGraph={genericFoldGraph}
                  foldProgress={assemblyGuideActive ? 1 : foldProgress}
                  hingeProgressById={assemblyHingeProgress}
                  selectedFaceId={selectedFaceId}
                  onFaceSelect={setSelectedFaceId}
                  cameraResetToken={cameraResetToken}
                />
              ) : (
                <div className="preview-error" role="status">
                  3D 접힘 경로를 구성할 수 없습니다.
                </div>
              )}
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
                <strong>{solidLabel}</strong>
                <small>
                  {solidKind === 'cuboid'
                    ? '기본 입체 · 6개 면'
                    : `${genericMesh?.faces.length ?? 0}개 면 · 모서리 ${edgeLengthMm} mm`}
                </small>
              </span>
              <span className="inspector-object__status">유효</span>
            </div>

            {solidKind === 'cuboid' ? (
              <>
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
              </>
            ) : (
              <>
                <div className="inspector-section-title">
                  <span>모서리 길이</span>
                  <span>단위: mm</span>
                </div>
                <label className="dimension-field polyhedron-edge-length">
                  <span className="dimension-field__label">모서리 길이</span>
                  <span
                    className={`dimension-input-wrap${edgeLengthError ? 'has-error' : ''}`}
                  >
                    <input
                      type="number"
                      min={MIN_DIMENSION_MM}
                      max={MAX_DIMENSION_MM}
                      step="0.1"
                      aria-label="모서리 길이 (mm)"
                      aria-invalid={Boolean(edgeLengthError)}
                      aria-describedby={
                        edgeLengthError ? 'edge-length-error' : undefined
                      }
                      value={edgeLengthDraft}
                      onChange={(event) => updateEdgeLength(event.target.value)}
                    />
                    <span>mm</span>
                  </span>
                  {edgeLengthError && (
                    <small
                      id="edge-length-error"
                      className="dimension-error"
                      role="alert"
                    >
                      {edgeLengthError}
                    </small>
                  )}
                </label>
                {genericUnfolding && !genericUnfolding.success && (
                  <p className="glue-tab-warning" role="status">
                    전개 실패: {genericUnfolding.issues.join(', ')}
                  </p>
                )}
                {genericIntersections.length > 0 && (
                  <p className="glue-tab-warning" role="status">
                    비인접 면 충돌 {genericIntersections.length}곳 · 면 ID와
                    접점은 geometry 진단 결과에 포함됩니다.
                  </p>
                )}
              </>
            )}

            <>
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
                        glueTabErrors.widthMm
                          ? 'glue-tab-width-error'
                          : undefined
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
                <label className="dimension-field">
                  <span className="dimension-field__label">탭 형태</span>
                  <select
                    aria-label="접착탭 형태"
                    value={glueTabOptions.shape ?? 'trapezoid'}
                    disabled={!glueTabOptions.enabled}
                    onChange={(event) =>
                      setGlueTabOptions((current) => ({
                        ...current,
                        shape: event.target.value as GlueTabOptions['shape'],
                      }))
                    }
                  >
                    <option value="trapezoid">사다리꼴</option>
                    <option value="beveled">좁은 베벨</option>
                    <option value="rectangular">직사각형</option>
                  </select>
                </label>
                <label className="dimension-field">
                  <span className="dimension-field__label">탭 방향</span>
                  <select
                    aria-label="접착탭 방향"
                    value={glueTabOptions.direction ?? 'outward'}
                    disabled={!glueTabOptions.enabled}
                    onChange={(event) =>
                      setGlueTabOptions((current) => ({
                        ...current,
                        direction: event.target
                          .value as GlueTabOptions['direction'],
                      }))
                    }
                  >
                    <option value="outward">외향</option>
                    <option value="inward">내향</option>
                  </select>
                </label>
              </div>
              {glueTabOptions.enabled && (
                <div
                  className="glue-tab-edge-list"
                  aria-label="접착탭 연결 모서리"
                >
                  {glueTabEdges.map((edge) => {
                    const disabled =
                      glueTabOptions.disabledEdgeIds?.includes(edge.id) ?? false
                    const connectedFaces = edge.adjacentFaceIds.join(' ↔ ')
                    return (
                      <label key={edge.id}>
                        <input
                          type="checkbox"
                          aria-label={`${connectedFaces} 접착탭`}
                          checked={!disabled}
                          onChange={(event) =>
                            setGlueTabOptions((current) => {
                              const disabledEdgeIds = new Set(
                                current.disabledEdgeIds ?? [],
                              )
                              if (event.target.checked)
                                disabledEdgeIds.delete(edge.id)
                              else disabledEdgeIds.add(edge.id)
                              return {
                                ...current,
                                disabledEdgeIds: [...disabledEdgeIds],
                              }
                            })
                          }
                        />
                        {connectedFaces}
                      </label>
                    )
                  })}
                </div>
              )}
              {glueTabOptions.enabled && activeTabInterferences.length > 0 && (
                <p className="glue-tab-warning" role="status">
                  접착탭이 서로 겹칩니다. 너비를 줄여주세요 (
                  {activeTabInterferences.length}곳)
                </p>
              )}
            </>

            <section className="assembly-guide" aria-label="조립 설명서">
              <div className="inspector-section-title">
                <span>조립 설명서</span>
                {assemblyGuide?.physicallyValidated === false && (
                  <span className="assembly-guide__badge">이상화 모델</span>
                )}
              </div>
              {!assemblyGuideActive ? (
                <button
                  className="assembly-guide__start"
                  type="button"
                  disabled={!assemblyGuide}
                  onClick={startAssemblyGuide}
                >
                  조립 순서 시작
                </button>
              ) : assemblyGuide ? (
                <>
                  <p className="assembly-guide__step">
                    {assemblyStepIndex >= assemblyGuide.steps.length
                      ? '모든 안내 단계를 마쳤습니다.'
                      : `단계 ${assemblyStepIndex + 1} / ${assemblyGuide.steps.length} · ${assemblyStep?.parentFaceId} 면에 ${assemblyStep?.faceId} 면을 접습니다.`}
                  </p>
                  <div className="assembly-guide__controls">
                    <button
                      type="button"
                      aria-label="조립 이전 단계"
                      disabled={assemblyStepIndex === 0 && foldProgress <= 0}
                      onClick={moveAssemblyGuidePrevious}
                    >
                      이전 단계
                    </button>
                    <button
                      type="button"
                      aria-label="조립 다음 단계"
                      disabled={assemblyStepIndex >= assemblyGuide.steps.length}
                      onClick={moveAssemblyGuideNext}
                    >
                      {foldProgress < 1 ? '현재 면 접기' : '다음 단계'}
                    </button>
                  </div>
                  <p className="assembly-guide__warning" role="status">
                    {assemblyGuide.warnings[0]}
                  </p>
                </>
              ) : (
                <p className="assembly-guide__warning" role="alert">
                  유효한 접힘 그래프를 만들 수 없어 설명서를 생성하지
                  못했습니다.
                </p>
              )}
            </section>

            <div className="inspector-section-title inspector-section-title--face">
              <span>선택한 면</span>
              <span>{selectedFaceId ? '선택됨' : '없음'}</span>
            </div>
            <div className="selected-face-card" aria-live="polite">
              <span
                className="selected-face-card__swatch"
                style={{ backgroundColor: selectedFaceMaterial?.color }}
              />
              <span>
                <strong>
                  {selectedFace?.label ??
                    selectedGenericFace?.label ??
                    '면을 선택하세요'}
                </strong>
                <small>
                  {selectedFace
                    ? `${selectedFace.widthMm} × ${selectedFace.heightMm} mm`
                    : selectedGenericFace
                      ? `${selectedGenericFace.polygon.length}개 꼭짓점 · ${selectedGenericFace.id}`
                      : '2D 또는 3D 뷰에서 선택'}
                </small>
              </span>
              <ChevronRight size={15} />
            </div>
            <div className="material-editor" aria-label="면 재질 편집기">
              <label className="material-editor__color">
                면 색상
                <input
                  type="color"
                  aria-label="선택 면 색상"
                  value={selectedFaceMaterial?.color ?? '#566174'}
                  disabled={!selectedFaceId}
                  onChange={(event) =>
                    selectedFaceMaterial &&
                    updateSelectedMaterial({
                      ...selectedFaceMaterial,
                      color: event.target.value,
                    })
                  }
                />
              </label>
              <div
                className="material-editor__presets"
                aria-label="재질 프리셋"
              >
                {Object.entries(MATERIAL_PRESETS).map(([id, material]) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={`${id} 재질 프리셋`}
                    title={`${id} 재질 프리셋`}
                    style={{ backgroundColor: material.color }}
                    disabled={!selectedFaceId}
                    onClick={() =>
                      selectedFaceMaterial &&
                      updateSelectedMaterial({
                        ...selectedFaceMaterial,
                        color: material.color,
                      })
                    }
                  />
                ))}
              </div>
              <label className="material-editor__upload">
                면 텍스처 불러오기
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="로컬 이미지 텍스처"
                  disabled={!selectedFaceId}
                  onChange={(event) =>
                    loadLocalTexture(event.target.files?.[0])
                  }
                />
              </label>
              {selectedFaceMaterial?.texture && (
                <div className="material-editor__texture-options">
                  {(
                    [
                      ['offsetX', '가로 위치', -100, 100, 1],
                      ['offsetY', '세로 위치', -100, 100, 1],
                      ['scale', '텍스처 크기', 0.1, 5, 0.1],
                      ['rotationDeg', '회전', 0, 360, 1],
                    ] as const
                  ).map(([field, label, min, max, step]) => (
                    <label key={field}>
                      {label}
                      <input
                        type="number"
                        min={min}
                        max={max}
                        step={step}
                        aria-label={label}
                        value={selectedFaceMaterial.texture?.[field] ?? 0}
                        onChange={(event) =>
                          updateSelectedTexture(field, event.target.value)
                        }
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      selectedFaceMaterial &&
                      updateSelectedMaterial({
                        ...selectedFaceMaterial,
                        texture: undefined,
                      })
                    }
                  >
                    텍스처 제거
                  </button>
                </div>
              )}
              {textureError && (
                <p className="glue-tab-warning" role="alert">
                  {textureError}
                </p>
              )}
            </div>
            <div className="inspector-footnote">
              {solidKind === 'cuboid' ? '치수' : '모서리 길이'} 범위{' '}
              {MIN_DIMENSION_MM}–{MAX_DIMENSION_MM.toLocaleString()} mm
            </div>
          </section>
        </aside>
      </main>

      {projectError && (
        <div className="project-file-error" role="alert">
          {projectError}
        </div>
      )}

      {svgExportOpen && (
        <div className="export-dialog-backdrop">
          <form
            className={
              exportFormat === 'pdf'
                ? 'export-dialog export-dialog--pdf'
                : 'export-dialog'
            }
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
                  setExportFormat(
                    event.target.value as 'svg' | 'pdf' | 'guide-pdf',
                  )
                  setExportError('')
                }}
              >
                <option value="svg">SVG · 벡터 도면</option>
                <option value="pdf">PDF · 인쇄용 페이지</option>
                <option value="guide-pdf">PDF · 조립 설명서</option>
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
                SVG에는 100 mm 선과 100 × 100 mm 교정 사각형이 포함됩니다. 실제
                크기/100%로 출력한 뒤 자로 치수를 확인하세요.
              </p>
            ) : exportFormat === 'guide-pdf' ? (
              <p className="export-dialog__note">
                {assemblyGuide
                  ? `${assemblyGuide.steps.length}개 단계가 포함된 A4 조립 설명서입니다. 실제 종이와 접착제 조립은 검증되지 않았습니다.`
                  : '유효한 접힘 트리가 없어 조립 설명서를 만들 수 없습니다.'}
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
                <p className="export-dialog__note" role="note">
                  PDF 인쇄 배율은 실제 크기/100%로 설정하고 페이지 맞춤, 축소
                  인쇄를 끄세요. 배율을 바꾸면 모든 기준 치수와 위치 검사 결과가
                  달라집니다.
                </p>
                <div
                  className="pdf-production-toggles"
                  aria-label="인쇄 요소 설정"
                >
                  <label>
                    <input
                      type="checkbox"
                      aria-label="재단선 표시"
                      checked={printSettings.showCutLines ?? true}
                      onChange={(event) =>
                        updatePrintSetting('showCutLines', event.target.checked)
                      }
                    />
                    재단선 표시
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      aria-label="접힘선 표시"
                      checked={printSettings.showFoldLines ?? true}
                      onChange={(event) =>
                        updatePrintSetting(
                          'showFoldLines',
                          event.target.checked,
                        )
                      }
                    />
                    접힘선 표시
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      aria-label="조립 번호 표시"
                      checked={printSettings.showAssemblyNumbers ?? true}
                      onChange={(event) =>
                        updatePrintSetting(
                          'showAssemblyNumbers',
                          event.target.checked,
                        )
                      }
                    />
                    조립 번호 표시
                  </label>
                </div>
                {printLayoutResult.layout ? (
                  <>
                    <p className="print-preview-summary" role="status">
                      {printLayoutResult.layout.pageWidthMm} ×{' '}
                      {printLayoutResult.layout.pageHeightMm} mm ·{' '}
                      {printLayoutResult.layout.tiles.length + 1}페이지 · 인쇄
                      가능 영역 {printLayoutResult.layout.printableWidthMm} ×{' '}
                      {printLayoutResult.layout.printableHeightMm} mm
                    </p>
                    {printerCorrection && (
                      <section
                        className="printer-correction-summary"
                        aria-label="보정 적용 미리보기"
                      >
                        <strong>
                          보정 적용 · {printerCorrection.profileName} · X{' '}
                          {(printerCorrection.xScale * 100).toFixed(2)}% · Y{' '}
                          {(printerCorrection.yScale * 100).toFixed(2)}%
                        </strong>
                        <span>
                          전개도 크기 {printableNet.bounds.width.toFixed(1)} ×{' '}
                          {printableNet.bounds.height.toFixed(1)} mm →{' '}
                          {calibratedPrintableNet.bounds.width.toFixed(1)} ×{' '}
                          {calibratedPrintableNet.bounds.height.toFixed(1)} mm.
                          용지 크기는 유지하고 보정된 전개도 기준으로 타일을
                          다시 계산했습니다.
                        </span>
                      </section>
                    )}
                    <PrintPagePreviews
                      net={calibratedPrintableNet}
                      layout={printLayoutResult.layout}
                      faceMaterials={calibratedFaceMaterials}
                    />
                  </>
                ) : (
                  <p className="glue-tab-warning" role="alert">
                    {printLayoutResult.error}
                  </p>
                )}
                {preflightReport && (
                  <section
                    className="print-preflight"
                    aria-label="PDF 사전 검사 결과"
                  >
                    <strong>
                      PDF 사전 검사 · {preflightReport.pageCount}페이지
                    </strong>
                    <ul>
                      {preflightReport.issues.map((issue, index) => (
                        <li key={`${issue.code}-${issue.itemId ?? index}`}>
                          <span data-preflight-severity={issue.severity}>
                            {issue.severity === 'error'
                              ? '오류'
                              : issue.severity === 'warning'
                                ? '경고'
                                : '정보'}
                          </span>
                          {' · '}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <section
                  className="print-calibration-editor"
                  aria-label="인쇄 배율 교정"
                >
                  <div>
                    <strong>{printSettings.paperSize} 실측 기록</strong>
                    <span>인쇄는 실제 크기 / 100%로 설정하세요.</span>
                  </div>
                  {CALIBRATION_REFERENCE_LENGTHS.map((targetMm) => {
                    const key = `${printSettings.paperSize}-${targetMm}`
                    const measurement = calibrationMeasurements.find(
                      (item) =>
                        item.paperSize === printSettings.paperSize &&
                        item.targetMm === targetMm,
                    )
                    const result = measurement
                      ? calculateCalibrationResult(
                          targetMm,
                          measurement.measuredMm,
                        )
                      : null
                    return (
                      <label key={targetMm}>
                        {targetMm} mm 기준 실제 측정 (mm)
                        <input
                          type="number"
                          min="0.1"
                          max="1000"
                          step="0.1"
                          aria-label={`${printSettings.paperSize} ${targetMm} mm 실측값`}
                          value={calibrationDrafts[key] ?? ''}
                          placeholder="측정 전"
                          onChange={(event) =>
                            updateCalibrationMeasurement(
                              targetMm,
                              event.target.value,
                            )
                          }
                        />
                        {result ? (
                          <span data-calibration-status={result.status}>
                            {result.status === 'within-tolerance'
                              ? '측정값 기준 허용 범위'
                              : '인쇄 배율 조정 권장'}
                            {' · '}
                            배율 {result.outputScalePercent.toFixed(2)}% · 오차{' '}
                            {result.scaleErrorPercent >= 0 ? '+' : ''}
                            {result.scaleErrorPercent.toFixed(2)}%
                          </span>
                        ) : (
                          <span>미측정 · 물리 출력 미검증</span>
                        )}
                      </label>
                    )
                  })}
                </section>
                {calibrationStorageError && (
                  <p className="dimension-error" role="alert">
                    {calibrationStorageError}
                  </p>
                )}
                <p className="export-dialog__note">
                  마지막 교정 페이지의 50/100/150 mm 선과 100 × 100 mm 사각형을
                  자로 측정하고 값을 기록하세요. 출력 창에서 Fit, Shrink, 페이지
                  맞춤을 끄세요. PDF와 브라우저만으로 실제 프린터 정확도는
                  보장되지 않습니다. 기록은 이 브라우저에만 저장됩니다.
                </p>
                <PrinterCalibrationPanel
                  paperSize={printSettings.paperSize}
                  orientation={printSettings.orientation}
                  onCorrectionChange={handlePrinterCorrectionChange}
                />
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
                  (exportFormat === 'pdf' && !printLayoutResult.layout) ||
                  (exportFormat === 'pdf' &&
                    Boolean(preflightReport?.hasErrors)) ||
                  (exportFormat === 'guide-pdf' && !assemblyGuide)
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
          {solidKind === 'cuboid' ? (
            <>
              <span>W {dimensions.widthMm}</span>
              <span> D {dimensions.depthMm}</span>
              <span> H {dimensions.heightMm}</span>
              <span className="status-divider" /> 6 faces · 12 edges
            </>
          ) : (
            <>
              <span>Edge {edgeLengthMm} mm</span>
              <span className="status-divider" />
              {genericMesh?.vertices.length ?? 0} vertices ·{' '}
              {genericMesh?.faces.length ?? 0} faces
            </>
          )}
        </div>
      </footer>
    </div>
  )
}

export default App
