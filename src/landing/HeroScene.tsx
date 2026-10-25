import { useEffect, useRef, useState } from 'react'
import { mountHeroScene, type SceneCommands } from '../scene/HeroSceneEngine'
import { WebGLFallback } from './WebGLFallback'

export default function HeroScene({
  onPhase,
}: {
  onPhase?: (phase: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const commands = useRef<SceneCommands | null>(null)
  const [fallback, setFallback] = useState(false)
  const [paused, setPaused] = useState(false)
  const [sound, setSound] = useState(false)
  const [isUnfolded, setIsUnfolded] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [phase, setPhase] = useState('종이의 가능성을 준비하고 있습니다')

  useEffect(() => {
    const host = container.current
    if (!host) return
    return mountHeroScene(host, {
      onPhase,
      setPhase,
      setFallback,
      setReduced,
      setPaused,
      setIsUnfolded,
      onCommands: (value) => {
        commands.current = value
      },
    })
  }, [onPhase])

  return (
    <div className="cinematic-showcase">
      <div ref={container} className="cinematic-canvas" hidden={fallback} />
      {fallback && <WebGLFallback />}
      <span className="cinematic-keyboard-hint">
        드래그 또는 방향키로 회전 · Home으로 시점 초기화
      </span>
      <p className="cinematic-caption" aria-live="polite">
        {phase}
      </p>
      {!fallback && (
        <div className="cinematic-controls" aria-label="3D 장면 제어">
          <button onClick={() => commands.current?.skip()}>건너뛰기</button>
          <button onClick={() => commands.current?.replay()}>다시 보기</button>
          <button
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
          <button
            aria-pressed={sound}
            onClick={() => {
              void commands.current?.sound().then(setSound)
            }}
          >
            소리 {sound ? '켜짐' : '꺼짐'}
          </button>
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
