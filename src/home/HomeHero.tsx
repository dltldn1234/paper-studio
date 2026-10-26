import { PreviewBoundary } from './PreviewBoundary'
import { lazy, Suspense, useState } from 'react'
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
  const [fold, setFold] = useState(1)
  return (
    <section className="home-hero">
      <div className="home-hero-copy">
        <div className="home-eyebrow">
          <span /> YOUR NEXT DIMENSION
        </div>
        <h1>
          아이디어를 종이 위에,
          <br />
          <span>가능성을 입체로.</span>
        </h1>
        <p>
          형태를 설계하고, 전개도를 만들고,
          <br className="home-mobile-break" /> 완성된 모습을 미리 확인하세요.
        </p>
        <div className="home-hero-actions">
          <button className="home-primary" onClick={onCreate}>
            <Plus size={18} />새 프로젝트 만들기
          </button>
          <a className="home-secondary" href="#templates">
            템플릿으로 시작하기 <ArrowRight size={16} />
          </a>
        </div>
        <div className="home-hero-note">
          <span /> 아이디어만 준비하세요. 설계는 여기서 시작됩니다.
        </div>
      </div>
      <div className="home-hero-model">
        <div className="home-model-label">
          <span>STRUCTURE STUDY / 001</span>
          <span>LIVE PREVIEW</span>
        </div>
        <div className="home-live-preview">
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
          <span>NET / 6 FACES</span>
        </div>
        <div className="home-model-controls">
          <span>전개도</span>
          <input
            aria-label="홈 접힘 미리보기"
            type="range"
            min="0"
            max="1"
            step=".01"
            value={fold}
            onChange={(e) => setFold(Number(e.target.value))}
          />
          <span>입체</span>
          <output>{Math.round(fold * 100)}%</output>
        </div>
        <div className="home-model-caption">
          <span>접어서 확인하는 새로운 관점</span>
          <span>100 × 80 × 60 mm</span>
        </div>
      </div>
    </section>
  )
}
