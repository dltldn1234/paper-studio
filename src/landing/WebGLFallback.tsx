import { Component, type ReactNode } from 'react'

export function WebGLFallback() {
  return (
    <div className="cinematic-fallback">
      <img
        src="/paper-dinosaur-poster.jpg"
        alt="접힌 종이 면으로 이루어진 티라노사우루스의 실제 3D 장면"
        width="1000"
        height="720"
      />
      <p>종이 한 장에서 시작되는 입체의 가능성.</p>
      <a href="/studio">스튜디오 시작하기 →</a>
    </div>
  )
}

export class SceneBoundary extends Component<
  { children: ReactNode; onUnavailable: (phase: string) => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onUnavailable('idle')
  }
  render() {
    return this.state.failed ? <WebGLFallback /> : this.props.children
  }
}
