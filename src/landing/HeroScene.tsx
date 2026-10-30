import { useEffect, useRef, useState } from 'react'
import { mountHeroScene, type SceneCommands } from '../scene/HeroSceneEngine'
import { WebGLFallback } from './WebGLFallback'

const homePhaseLabels: Record<string, string> = {
  blueprint: '전개도를 그리고 있습니다',
  construction: '면을 하나씩 접고 있습니다',
  awakening: '형태가 깨어나고 있습니다',
  reveal: '종이에서 입체로',
  idle: '종이 구조 미리보기',
}

export default function HeroScene({
  onPhase,
  onPausedChange,
  mode = 'showcase',
}: {
  onPhase?: (phase: string) => void
  onPausedChange?: (paused: boolean) => void
  mode?: 'home' | 'showcase'
}) {
  const container = useRef<HTMLDivElement>(null)
  const commands = useRef<SceneCommands | null>(null)
  const [fallback, setFallback] = useState(false)
  const [paused, setPaused] = useState(false)
  const [sound, setSound] = useState(false)
  const [isUnfolded, setIsUnfolded] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [phase, setPhase] = useState(
    mode === 'home'
      ? '종이 구조를 준비하고 있습니다'
      : '종이의 가능성을 준비하고 있습니다',
  )
  const [phaseKey, setPhaseKey] = useState('blueprint')

  useEffect(() => {
    onPausedChange?.(paused)
  }, [paused, onPausedChange])

  useEffect(() => {
    const host = container.current
    if (!host) return
    return mountHeroScene(
      host,
      {
        onPhase: (value) => {
          setPhaseKey(value)
          onPhase?.(value)
        },
        setPhase: (value) =>
          setPhase(mode === 'home' ? (homePhaseLabels[value] ?? value) : value),
        setFallback,
        setReduced,
        setPaused,
        setIsUnfolded,
        onCommands: (value) => {
          commands.current = value
        },
      },
      { replayOnMount: mode === 'home' },
    )
  }, [mode, onPhase])

  return (
    <div className="cinematic-showcase" data-phase={phaseKey}>
      <div ref={container} className="cinematic-canvas" hidden={fallback} />
      {fallback && <WebGLFallback />}
      <span className="cinematic-keyboard-hint">
        {mode === 'home'
          ? '드래그 또는 방향키로 회전 · Home 키로 시점 초기화'
          : '드래그 또는 방향키로 회전 · Home으로 시점 초기화'}
      </span>
      <p className="cinematic-caption" aria-live="polite">
        {phase}
      </p>
      {!fallback && (
        <div
          className="cinematic-controls"
          aria-label="3D와 페이지 애니메이션 제어"
        >
          {mode === 'showcase' && (
            <>
              <button onClick={() => commands.current?.skip()}>건너뛰기</button>
              <button onClick={() => commands.current?.replay()}>
                다시 보기
              </button>
            </>
          )}
          {mode === 'home' && (
            <button onClick={() => commands.current?.replay()}>
              다시 보기
            </button>
          )}
          <button
            title="3D와 페이지 애니메이션 일시정지"
            aria-pressed={paused}
            onClick={() => commands.current?.pause()}
          >
            {paused ? '재생' : '일시정지'}
          </button>
          <button
            aria-label="펼치기 / 접기"
            aria-pressed={isUnfolded}
            onClick={() => commands.current?.unfold()}
          >
            {isUnfolded ? '입체로 접기' : '전개도 펼치기'}
          </button>
          <button onClick={() => commands.current?.reset()}>시점 초기화</button>
          {mode === 'showcase' && (
            <button
              aria-pressed={sound}
              onClick={() => {
                void commands.current?.sound().then(setSound)
              }}
            >
              소리 {sound ? '켜짐' : '꺼짐'}
            </button>
          )}
          <button
            aria-pressed={reduced}
            onClick={() => commands.current?.reduce(!reduced)}
          >
            모션 줄이기
          </button>
        </div>
      )}
    </div>
  )
}
