import { StudioLink } from './StudioLink'
import { SceneBoundary } from './WebGLFallback'
import { lazy, Suspense, useState } from 'react'
import {
  ArrowDown,
  ArrowUpRight,
  Box,
  Layers3,
  Printer,
  Ruler,
} from 'lucide-react'
import './landing.css'

const HeroScene = lazy(() => import('./HeroScene'))

const workflow = [
  {
    number: '01',
    title: '치수로 구조를 설계하고',
    description: '밀리미터 단위의 값이 실제 구조의 기준이 됩니다.',
    icon: Ruler,
  },
  {
    number: '02',
    title: '평면 전개도를 확인하고',
    description: '면과 접힘선을 따라 종이 위의 형태를 살펴봅니다.',
    icon: Layers3,
  },
  {
    number: '03',
    title: '입체로 접어 보고',
    description: '3D 미리보기에서 설계한 구조를 여러 방향으로 확인합니다.',
    icon: Box,
  },
  {
    number: '04',
    title: '종이로 완성하세요.',
    description: '출력용 SVG와 PDF 도면을 만들어 손으로 조립합니다.',
    icon: Printer,
  },
]

function StructureSchematic() {
  return (
    <figure className="landing-schematic">
      <div className="landing-schematic__header">
        <span>STRUCTURE STUDY</span>
        <span>01 / 04</span>
      </div>
      <svg
        className="landing-schematic__drawing"
        viewBox="0 0 680 480"
        role="img"
        aria-labelledby="schematic-title schematic-description"
      >
        <title id="schematic-title">직육면체 전개도와 입체 구조 예시</title>
        <desc id="schematic-description">
          100 × 80 × 60 밀리미터 직육면체의 선 전개도와 파란 선으로 표시한 입체
          미리보기입니다.
        </desc>
        <defs>
          <linearGradient id="schematic-face" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#477fcf" stopOpacity=".34" />
            <stop offset="1" stopColor="#12243c" stopOpacity=".18" />
          </linearGradient>
          <linearGradient id="schematic-edge" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#8abaff" />
            <stop offset="1" stopColor="#3474da" />
          </linearGradient>
          <pattern
            id="schematic-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="#25364b"
              strokeWidth=".65"
            />
          </pattern>
        </defs>
        <rect
          width="680"
          height="480"
          fill="url(#schematic-grid)"
          opacity=".53"
        />
        <g
          className="schematic-net"
          fill="none"
          stroke="#57799f"
          strokeDasharray="5 5"
          strokeWidth="1.5"
        >
          <path d="M108 173h74v56h-74zM182 173h92v56h-92zM274 173h74v56h-74zM348 173h92v56h-92z" />
          <path d="M182 117h92v56h-92zM182 229h92v56h-92z" />
          <path
            d="M182 117v168M274 117v168M108 173h332M108 229h332"
            strokeDasharray="2 5"
          />
        </g>
        <g
          className="schematic-solid"
          stroke="url(#schematic-edge)"
          strokeLinejoin="round"
          strokeWidth="2"
        >
          <path d="M402 188l93-53 98 37-94 55z" fill="url(#schematic-face)" />
          <path d="M402 188v110l97 40V227z" fill="#182943" fillOpacity=".78" />
          <path
            d="M499 227l94-55v110l-94 56z"
            fill="#264a76"
            fillOpacity=".62"
          />
          <path
            d="M402 298l97 40 94-56M402 188l97 39 94-55M499 227v111"
            fill="none"
          />
        </g>
        <g
          className="schematic-guides"
          fill="#9cb4d2"
          fontFamily="inherit"
          fontSize="11"
          letterSpacing="1.4"
        >
          <path d="M401 319v20m0-10h97m0-10v20" fill="none" stroke="#5f7692" />
          <text x="437" y="355">
            100 mm
          </text>
          <text x="116" y="154">
            FLAT PATTERN
          </text>
          <text x="494" y="119">
            VOLUME STUDY
          </text>
          <text x="38" y="438" fill="#71859e">
            PAPER STUDIO · GEOMETRY PREVIEW
          </text>
        </g>
        <circle
          className="schematic-highlight"
          cx="529"
          cy="185"
          r="3"
          fill="#a9ceff"
        />
      </svg>
      <figcaption>
        <span>전개도와 입체 구조를 하나의 설계에서</span>
        <span>100 × 80 × 60 mm</span>
      </figcaption>
    </figure>
  )
}

export default function CinematicLanding() {
  const [phase, setPhase] = useState('idle')
  return (
    <main className="landing-page" data-intro-phase={phase}>
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="Paper Studio 홈">
          <span className="landing-brand__mark" aria-hidden="true">
            <Box size={18} strokeWidth={1.6} />
          </span>
          <span>
            paper<span className="landing-brand__dot">.</span>studio
          </span>
        </a>
        <nav className="landing-nav" aria-label="주요 메뉴">
          <a href="#workflow">제품 소개</a>
          <a href="#capabilities">기능</a>
        </nav>
        <StudioLink className="landing-header__cta" href="/studio">
          스튜디오 시작하기 <ArrowUpRight size={15} aria-hidden="true" />
        </StudioLink>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__copy">
          <p className="landing-eyebrow">
            <span /> PAPER STRUCTURE DESIGN STUDIO
          </p>
          <h1 id="landing-title">
            종이 위의 상상이,
            <br />
            <span>현실의 구조가 되다.</span>
          </h1>
          <p className="landing-hero__description">
            아이디어부터 정교한 전개도까지.{' '}
            <br className="landing-desktop-break" />
            Paper Studio에서 설계하고, 접고, 완성하세요.
          </p>
          <div className="landing-hero__actions">
            <StudioLink className="landing-primary-action" href="/studio">
              스튜디오 시작하기 <ArrowUpRight size={16} aria-hidden="true" />
            </StudioLink>
            <StudioLink
              className="landing-secondary-action"
              href="/studio?sample=tetrahedron"
            >
              샘플 프로젝트 열기 <ArrowUpRight size={15} aria-hidden="true" />
            </StudioLink>
          </div>
          <div className="landing-hero__proof" id="capabilities">
            <span>
              <i aria-hidden="true" /> 기하 기반 설계
            </span>
            <span>
              <i aria-hidden="true" /> 실제 크기 단위
            </span>
            <span>
              <i aria-hidden="true" /> 브라우저에서 바로
            </span>
          </div>
        </div>
        <div className="landing-hero__visual">
          <SceneBoundary onUnavailable={setPhase}>
            <Suspense fallback={<StructureSchematic />}>
              <HeroScene onPhase={setPhase} />
            </Suspense>
          </SceneBoundary>
          <span className="landing-visual-index" aria-hidden="true">
            FIG. 01 — THE PAPER AWAKENS
          </span>
        </div>
        <a className="landing-scroll-cue" href="#workflow">
          아래로 스크롤 <ArrowDown size={14} aria-hidden="true" />
        </a>
      </section>

      <section
        className="landing-workflow"
        id="workflow"
        aria-labelledby="workflow-title"
      >
        <div className="landing-section-heading">
          <p className="landing-eyebrow">FROM IDEA TO OBJECT</p>
          <h2 id="workflow-title">설계부터 종이 위의 완성까지.</h2>
          <p>
            모양을 만들고, 접어 보고, 직접 출력할 수 있는 도면으로 이어집니다.
          </p>
        </div>
        <ol className="landing-workflow__steps">
          {workflow.map(({ number, title, description, icon: Icon }) => (
            <li key={number}>
              <span className="landing-workflow__number">{number}</span>
              <span className="landing-workflow__icon" aria-hidden="true">
                <Icon size={18} strokeWidth={1.6} />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="landing-footer">
        <a className="landing-brand" href="/" aria-label="Paper Studio 홈">
          <span className="landing-brand__mark" aria-hidden="true">
            <Box size={16} strokeWidth={1.6} />
          </span>
          <span>
            paper<span className="landing-brand__dot">.</span>studio
          </span>
        </a>
        <span>종이의 가능성을 설계합니다.</span>
        <a href="/studio">
          스튜디오 열기 <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </footer>
    </main>
  )
}
