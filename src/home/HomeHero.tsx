import { PreviewBoundary } from './PreviewBoundary'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Plus, ArrowRight } from 'lucide-react'
import { templateProject } from './templates'
import { createCuboid, createCuboidNet } from '../geometry'
import { SolidThumbnail } from './SolidThumbnail'
const ThreeCuboidPreview = lazy(() =>
  import('../preview/ThreeCuboidPreview').then((module) => ({
    default: module.ThreeCuboidPreview,
  })),
)
const demo = templateProject('cuboid')
const demoCuboid = createCuboid(demo.dimensions)
const demoNet = createCuboidNet(demo.dimensions, demo.glueTabOptions)
export function HomeHero({ onCreate }: { onCreate: () => void }) {
  const [fold, setFold] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0,
  )
  const [previewReady, setPreviewReady] = useState(false)
  const userAdjustedFold = useRef(false)
  const foldFrame = useRef<number | null>(null)
  const handlePreviewReady = useCallback(() => setPreviewReady(true), [])
  useEffect(() => {
    if (
      !previewReady ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return
    let startedAt: number | null = null
    let timeout = 0
    const animateFold = (time: number) => {
      if (userAdjustedFold.current) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setFold(1)
        return
      }
      startedAt ??= time
      const progress = Math.min((time - startedAt) / 1800, 1)
      setFold(1 - Math.pow(1 - progress, 3))
      if (progress < 1) foldFrame.current = requestAnimationFrame(animateFold)
    }
    timeout = window.setTimeout(() => {
      foldFrame.current = requestAnimationFrame(animateFold)
    }, 420)
    return () => {
      window.clearTimeout(timeout)
      if (foldFrame.current !== null) cancelAnimationFrame(foldFrame.current)
    }
  }, [previewReady])
  return (
    <section className="home-hero">
      <div className="home-hero-copy" data-motion-reveal>
        <div className="home-eyebrow">
          <span /> PAPER STUDIO · DESIGN SYSTEM 01
        </div>
        <h1>
          종이를 접어,
          <br /> <span>공간을 설계하다.</span>
        </h1>
        <p>
          형태를 설계하고, 전개도를 만들고,
          <br className="home-mobile-break" /> 종이 위의 아이디어를 입체로
          완성하세요.
        </p>
        <div className="home-hero-actions">
          <button
            className="home-primary"
            data-motion-magnet
            onClick={onCreate}
          >
            <Plus size={18} />새 프로젝트 만들기
          </button>
          <a className="home-secondary" data-motion-magnet href="#templates">
            템플릿으로 시작하기 <ArrowRight size={16} />
          </a>
        </div>
        <div className="home-hero-note">
          <span /> 계정 없이 시작 · 브라우저에 안전하게 저장
        </div>
      </div>
      <div
        className="home-hero-model"
        data-motion-reveal
        data-motion-depth
        data-preview-ready={previewReady ? 'true' : 'false'}
        aria-label="직육면체 3D 설계 미리보기"
      >
        <div className="home-model-coordinate" aria-hidden="true">
          <span>+Y</span>
          <span>+X</span>
          <span>+Z</span>
        </div>
        <div className="home-model-label">
          <span>
            VOLUME STUDY <i>—</i> 001
          </span>
          <span>
            <i /> LIVE GEOMETRY
          </span>
        </div>
        <div className="home-live-preview">
          <div
            className="home-stage-crosshair home-stage-crosshair--one"
            aria-hidden="true"
          />
          <div
            className="home-stage-crosshair home-stage-crosshair--two"
            aria-hidden="true"
          />
          <PreviewBoundary>
            <Suspense
              fallback={
                <div className="home-preview-loading" role="status">
                  <SolidThumbnail project={demo} />
                  <span>3D 미리보기 준비 중…</span>
                </div>
              }
            >
              <ThreeCuboidPreview
                presentation="home"
                onPreviewReady={handlePreviewReady}
                cuboid={demoCuboid}
                netLayout={demoNet}
                foldProgress={fold}
                cameraResetToken={0}
                selectedFaceId={null}
                onFaceSelect={() => {}}
              />
            </Suspense>
          </PreviewBoundary>
        </div>
        <div className="home-net-study" aria-label="동일 모델의 실제 전개도">
          <svg
            viewBox={`${demoNet.bounds.x - 10} ${demoNet.bounds.y - 10} ${demoNet.bounds.width + 20} ${demoNet.bounds.height + 20}`}
            aria-hidden="true"
          >
            {demoNet.faces.map((face) => (
              <polygon
                key={face.id}
                points={face.polygon.vertices
                  .map((p) => `${p.x},${p.y}`)
                  .join(' ')}
                fill="#367bff0d"
                stroke="#6e9bdf"
                strokeWidth="1.5"
              />
            ))}
            {demoNet.edges
              .filter((edge) => edge.kind === 'fold')
              .map((edge) => (
                <line
                  key={edge.id}
                  x1={edge.start.x}
                  y1={edge.start.y}
                  x2={edge.end.x}
                  y2={edge.end.y}
                  stroke="#bdd1f0"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              ))}
          </svg>
          <span>FLAT PATTERN / 06 FACES</span>
        </div>
        <div className="home-model-controls">
          <span>FLAT</span>
          <input
            aria-label="홈 접힘 미리보기"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={fold}
            onChange={(e) => {
              userAdjustedFold.current = true
              if (foldFrame.current !== null)
                cancelAnimationFrame(foldFrame.current)
              setFold(Number(e.target.value))
            }}
          />
          <span>FORM</span>
          <output>{Math.round(fold * 100)}%</output>
        </div>
        <div className="home-model-caption">
          <span>직접 드래그하여 구조를 살펴보세요</span>
          <span>
            W {demo.dimensions.widthMm} <i>·</i> D {demo.dimensions.depthMm}{' '}
            <i>·</i> H {demo.dimensions.heightMm} mm
          </span>
        </div>
      </div>
    </section>
  )
}
