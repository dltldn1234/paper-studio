import { Component, useEffect, useState, type ReactNode } from 'react'
import {
  readMotionPreferences,
  saveMotionPreferences,
  MOTION_PREFERENCES_EVENT,
} from '../persistence/motion-preferences'
import { LANDING_PAUSE_EVENT } from './landingMotion'

function FallbackMotionControls() {
  const [paused, setPaused] = useState(
    () =>
      document
        .querySelector('.landing-page')
        ?.getAttribute('data-page-motion') === 'paused',
  )
  const [reduced, setReduced] = useState(
    () =>
      readMotionPreferences().reduce ??
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMedia = () => setReduced(media.matches)
    const onPreference = (event: Event) => {
      const value = (event as CustomEvent<{ reduce?: boolean }>).detail?.reduce
      if (typeof value === 'boolean') setReduced(value)
    }
    media.addEventListener?.('change', onMedia)
    window.addEventListener(MOTION_PREFERENCES_EVENT, onPreference)
    return () => {
      media.removeEventListener?.('change', onMedia)
      window.removeEventListener(MOTION_PREFERENCES_EVENT, onPreference)
    }
  }, [])
  return (
    <div className="cinematic-controls" aria-label="페이지 애니메이션 제어">
      <button
        aria-pressed={paused}
        onClick={() => {
          const value = !paused
          setPaused(value)
          window.dispatchEvent(
            new CustomEvent(LANDING_PAUSE_EVENT, { detail: { paused: value } }),
          )
        }}
      >
        {paused ? '재생' : '일시정지'}
      </button>
      <button
        aria-pressed={reduced}
        onClick={() => {
          const value = !reduced
          setReduced(value)
          saveMotionPreferences({ reduce: value })
        }}
      >
        모션 줄이기
      </button>
    </div>
  )
}

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
      <FallbackMotionControls />
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
