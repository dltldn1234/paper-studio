import { sampleProject } from '../persistence/editor-draft'
import type { ProjectSolidKind } from '../project/project-file'
export const templates: {
  kind: ProjectSolidKind
  name: string
  description: string
  dimensions: string
}[] = [
  {
    kind: 'cuboid',
    name: '직육면체',
    description: '패키지와 작은 공간의 시작',
    dimensions: '100 × 80 × 60 mm',
  },
  {
    kind: 'cube',
    name: '정육면체',
    description: '균형 잡힌 여섯 면의 구조',
    dimensions: '한 모서리 100 mm',
  },
  {
    kind: 'tetrahedron',
    name: '정사면체',
    description: '네 개의 삼각형으로 만드는 형태',
    dimensions: '한 모서리 100 mm',
  },
  {
    kind: 'octahedron',
    name: '정팔면체',
    description: '입체적인 조형을 위한 여덟 면',
    dimensions: '한 모서리 100 mm',
  },
]
export function templateProject(kind: ProjectSolidKind) {
  return {
    ...sampleProject(),
    name: `${templates.find((item) => item.kind === kind)!.name} 프로젝트`,
    solidKind: kind,
    foldProgress: 1,
  }
}
