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

export const PROJECT_FILE_VERSION = 1

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
}

export type ProjectDraft = Omit<PaperStudioProject, 'version' | 'name'> & {
  name?: string
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
    tabs.angleDeg > MAX_GLUE_TAB_ANGLE_DEG
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
  validateProject(value)
  return value
}
