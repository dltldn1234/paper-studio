import { SceneBoundary } from '../landing/WebGLFallback'
import { lazy, Suspense, useState } from 'react'
import { ArrowDown, ArrowUpRight, Plus } from 'lucide-react'

const HeroScene = lazy(() => import('../landing/HeroScene'))

const scenePhases: Record<string, string> = {
  blueprint: '전개도를 그리고 있습니다',
  construction: '면을 하나씩 접고 있습니다',
  awakening: '형태가 깨어나고 있습니다',
  reveal: '종이에서 입체로',
  idle: '종이 구조 미리보기',
}

export function HomeHero({ onCreate }: { onCreate: () => void }) {
  const [phase, setPhase] = useState('blueprint')
  return (
    <section
      className="home-hero home-hero--cinematic"
      aria-labelledby="home-title"
    >
      <div className="home-hero-copy">
        <h1 id="home-title">
          한 장의 종이에서,
          <br />
          <span>입체가 깨어나다.</span>
        </h1>
        <p>전개도를 그리고, 접고, 완성될 형태를 실시간 3D로 확인하세요.</p>
        <div className="home-hero-actions">
          <button className="home-primary" onClick={onCreate}>
            <Plus size={18} aria-hidden="true" />새 설계 시작하기
          </button>
          <a className="home-secondary" href="#templates">
            템플릿 둘러보기 <ArrowDown size={16} aria-hidden="true" />
          </a>
        </div>
        <div className="home-hero-note">
          계정 없이 시작하고, 이 브라우저에 안전하게 저장하세요.
        </div>
      </div>

      <figure
        className="home-hero-scene"
        aria-label="종이 구조가 입체로 접히는 장면"
      >
        <div className="home-scene-header" aria-hidden="true">
          <span>실시간 종이 구조 시연</span>
          <span>종이에서 입체로</span>
        </div>
        <div className="home-scene-canvas">
          <SceneBoundary onUnavailable={() => setPhase('idle')}>
            <Suspense
              fallback={
                <div className="home-scene-loading" role="status">
                  <img
                    src="/paper-dinosaur-poster.jpg"
                    alt=""
                    width="1000"
                    height="720"
                  />
                  <span>종이 구조를 펼치고 있습니다</span>
                </div>
              }
            >
              <HeroScene mode="home" onPhase={setPhase} />
            </Suspense>
          </SceneBoundary>
        </div>
        <figcaption className="home-scene-caption">
          <span>전개도에서 입체 구조까지</span>
          <span role="status" aria-live="polite">
            {scenePhases[phase] ?? scenePhases.idle}
          </span>
        </figcaption>
        <a className="home-scene-editor" href="/showcase">
          3D 장면 더 살펴보기 <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </figure>
    </section>
  )
}
