import { Component, type ReactNode } from 'react'
import { SolidThumbnail } from './SolidThumbnail'
import { templateProject } from './templates'

export class PreviewBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <div className="home-preview-loading" role="status">
          <SolidThumbnail project={templateProject('cuboid')} />
          <span>3D를 불러오지 못했습니다. 템플릿으로 설계를 시작하세요.</span>
        </div>
      )
    return this.props.children
  }
}
