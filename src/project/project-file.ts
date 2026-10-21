import {
  MAX_GLUE_TAB_ANGLE_DEG,
  MAX_GLUE_TAB_WIDTH_MM,
  MIN_GLUE_TAB_ANGLE_DEG,
  MIN_GLUE_TAB_WIDTH_MM,
  validateCuboidDimensions,
} from '../geometry'
import type {
  CuboidDimensions,
  GlueTabOptions,
  RegularPolyhedronKind,
} from '../geometry'
import type { PrintSettings } from '../export/print-layout'
import { validateFaceMaterial } from '../materials/materials'
import type { FaceMaterial } from '../materials/materials'

export const PROJECT_FILE_VERSION = 2

export type ProjectSolidKind = 'cuboid' | RegularPolyhedronKind

export type PaperStudioProject = {
  version: typeof PROJECT_FILE_VERSION
  name: string
  solidKind: ProjectSolidKind
  dimensions: CuboidDimensions
  edgeLengthMm: number
  glueTabOptions: GlueTabOptions
  customFoldEdgeIds: string[] | null
  selectedFaceId: string | null
  selectedEdgeId: string | null
  foldProgress: number
  printSettings: PrintSettings
  faceMaterials: Record<string, FaceMaterial>
}

export type ProjectDraft = Omit<
  PaperStudioProject,
  'version' | 'name' | 'faceMaterials'
> & {
  name?: string
  faceMaterials?: Record<string, FaceMaterial>
}

const solidKinds = new Set<ProjectSolidKind>([
  'cuboid',
  'tetrahedron',
  'cube',
  'octahedron',
])
const paperSizes = new Set(['A4', 'A3'])
const orientations = new Set(['portrait', 'landscape'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function createProjectDocument(draft: ProjectDraft): PaperStudioProject {
  const project = {
    version: PROJECT_FILE_VERSION,
    name: draft.name?.trim() || 'Paper Studio project',
    ...draft,
    faceMaterials: draft.faceMaterials ?? {},
  } as PaperStudioProject
  validateProject(project)
  return project
}

export function validateProject(
  value: unknown,
): asserts value is PaperStudioProject {
  if (!isRecord(value) || value.version !== PROJECT_FILE_VERSION) {
    throw new RangeError(
      `Unsupported project file version (expected ${PROJECT_FILE_VERSION}).`,
    )
  }
  if (typeof value.name !== 'string' || !value.name.trim()) {
    throw new RangeError('Project name must be a non-empty string.')
  }
  if (!solidKinds.has(value.solidKind as ProjectSolidKind)) {
    throw new RangeError('Project contains an unsupported solid type.')
  }
  if (!isRecord(value.dimensions)) {
    throw new RangeError('Project dimensions are missing.')
  }
  const dimensions = value.dimensions as unknown as CuboidDimensions
  if (!validateCuboidDimensions(dimensions).valid) {
    throw new RangeError('Project dimensions are outside the supported range.')
  }
  if (
    !isFiniteNumber(value.edgeLengthMm) ||
    !validateCuboidDimensions({
      widthMm: value.edgeLengthMm,
      depthMm: value.edgeLengthMm,
      heightMm: value.edgeLengthMm,
    }).valid
  ) {
    throw new RangeError('Project edge length is outside the supported range.')
  }
  if (!isRecord(value.glueTabOptions)) {
    throw new RangeError('Project glue tab options are missing.')
  }
  const tabs = value.glueTabOptions
  if (
    typeof tabs.enabled !== 'boolean' ||
    !isFiniteNumber(tabs.widthMm) ||
    tabs.widthMm < MIN_GLUE_TAB_WIDTH_MM ||
    tabs.widthMm > MAX_GLUE_TAB_WIDTH_MM ||
    !isFiniteNumber(tabs.angleDeg) ||
    tabs.angleDeg < MIN_GLUE_TAB_ANGLE_DEG ||
    tabs.angleDeg > MAX_GLUE_TAB_ANGLE_DEG ||
    (tabs.shape !== undefined &&
      !['beveled', 'trapezoid', 'rectangular'].includes(String(tabs.shape))) ||
    (tabs.direction !== undefined &&
      !['outward', 'inward'].includes(String(tabs.direction))) ||
    (tabs.disabledEdgeIds !== undefined &&
      (!Array.isArray(tabs.disabledEdgeIds) ||
        tabs.disabledEdgeIds.some((id) => typeof id !== 'string') ||
        new Set(tabs.disabledEdgeIds).size !== tabs.disabledEdgeIds.length))
  ) {
    throw new RangeError('Project glue tab options are invalid.')
  }
  if (
    value.customFoldEdgeIds !== null &&
    (!Array.isArray(value.customFoldEdgeIds) ||
      value.customFoldEdgeIds.some((id) => typeof id !== 'string') ||
      new Set(value.customFoldEdgeIds).size !== value.customFoldEdgeIds.length)
  ) {
    throw new RangeError('Project custom fold edges are invalid.')
  }
  if (
    (value.selectedFaceId !== null &&
      typeof value.selectedFaceId !== 'string') ||
    (value.selectedEdgeId !== null && typeof value.selectedEdgeId !== 'string')
  ) {
    throw new RangeError('Project selection state is invalid.')
  }
  if (
    !isFiniteNumber(value.foldProgress) ||
    value.foldProgress < 0 ||
    value.foldProgress > 1
  ) {
    throw new RangeError('Project fold progress must be between 0 and 1.')
  }
  if (!isRecord(value.printSettings)) {
    throw new RangeError('Project print settings are missing.')
  }
  if (!isRecord(value.faceMaterials)) {
    throw new RangeError('Project face materials are missing or invalid.')
  }
  for (const [faceId, material] of Object.entries(value.faceMaterials)) {
    if (!faceId) throw new RangeError('Project face material ID is invalid.')
    validateFaceMaterial(material)
  }
  const settings = value.printSettings
  if (
    !paperSizes.has(String(settings.paperSize)) ||
    !orientations.has(String(settings.orientation)) ||
    !isFiniteNumber(settings.marginMm) ||
    settings.marginMm < 0 ||
    !isFiniteNumber(settings.overlapMm) ||
    settings.overlapMm < 0
  ) {
    throw new RangeError('Project print settings are invalid.')
  }
}

export function serializeProject(project: PaperStudioProject): string {
  validateProject(project)
  return `${JSON.stringify(project, null, 2)}\n`
}

export function parseProject(source: string): PaperStudioProject {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new SyntaxError('Project file is not valid JSON.')
  }
  if (isRecord(value) && value.version === 1) {
    value = { ...value, version: PROJECT_FILE_VERSION, faceMaterials: {} }
  }
  validateProject(value)
  return value
}
