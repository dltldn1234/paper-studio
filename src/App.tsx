import {
  Box,
  Download,
  Grid2X2,
  Layers3,
  MousePointer2,
  Rotate3D,
  Scissors,
  Undo2,
  Redo2,
} from 'lucide-react'

const tools = [
  { label: '선택', icon: MousePointer2, active: true },
  { label: '면 추가', icon: Grid2X2 },
  { label: '접기 선', icon: Layers3 },
  { label: '자르기 선', icon: Scissors },
]

function App() {
  return (
    <main className="bg-paper text-ink min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-stone-200 px-8">
        <a
          className="flex items-center gap-2 font-semibold tracking-tight"
          href="#"
        >
          <span className="bg-ink grid size-8 place-items-center rounded-lg text-white">
            <Box size={18} />
          </span>
          <span>
            paper<span className="text-clay">.</span>studio
          </span>
        </a>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-500">모든 변경사항 저장됨</span>
          <button className="button-secondary">
            <Undo2 size={16} /> <span className="sr-only">실행 취소</span>
          </button>
          <button className="button-secondary">
            <Redo2 size={16} /> <span className="sr-only">다시 실행</span>
          </button>
          <button className="button-primary">
            <Download size={16} /> 내보내기
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-8 py-8">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <p className="text-clay mb-2 text-xs font-semibold tracking-[0.2em] uppercase">
              새로운 프로젝트
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              종이 오브제 만들기
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              평면 전개도를 그리고 입체 형태를 미리 확인해 보세요.
            </p>
          </div>
          <button className="button-secondary">
            <Rotate3D size={16} /> 3D 미리보기
          </button>
        </div>

        <div className="grid min-h-[580px] grid-cols-[240px_1fr_280px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <aside className="border-r border-stone-200 p-5">
            <h2 className="mb-4 text-xs font-semibold tracking-wider text-stone-400 uppercase">
              도구
            </h2>
            <div className="space-y-1">
              {tools.map(({ label, icon: Icon, active }) => (
                <button
                  key={label}
                  className={`tool-button ${active ? 'tool-button-active' : ''}`}
                >
                  <Icon size={17} strokeWidth={1.8} /> {label}
                </button>
              ))}
            </div>
            <div className="mt-8 border-t border-stone-100 pt-5">
              <h2 className="mb-3 text-xs font-semibold tracking-wider text-stone-400 uppercase">
                레이어
              </h2>
              <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-sm">
                전개도 1
              </div>
            </div>
          </aside>

          <section
            className="relative grid place-items-center bg-[#fbfaf7] p-8"
            aria-label="전개도 작업 영역"
          >
            <div className="canvas-grid absolute inset-0 opacity-60" />
            <div className="relative flex flex-col items-center gap-5">
              <div className="net-shadow relative grid grid-cols-3 grid-rows-3">
                <div className="face face-fold col-start-2 row-start-1" />
                <div className="face face-fold col-start-1 row-start-2" />
                <div className="face face-center col-start-2 row-start-2">
                  <span>1</span>
                </div>
                <div className="face face-fold col-start-3 row-start-2" />
                <div className="face face-fold col-start-2 row-start-3" />
              </div>
              <p className="text-xs text-stone-400">
                정육면체 전개도 · A4 용지
              </p>
            </div>
            <div className="absolute bottom-5 left-5 rounded-lg border border-stone-200 bg-white/90 px-3 py-2 text-xs text-stone-500">
              100%
            </div>
          </section>

          <aside className="border-l border-stone-200 p-5">
            <h2 className="mb-5 text-xs font-semibold tracking-wider text-stone-400 uppercase">
              문서 설정
            </h2>
            <label className="mb-2 block text-sm font-medium">종이 크기</label>
            <select className="field mb-5" defaultValue="A4">
              <option>A4</option>
              <option>A3</option>
              <option>Letter</option>
            </select>
            <label className="mb-2 block text-sm font-medium">방향</label>
            <div className="mb-5 grid grid-cols-2 gap-2">
              <button className="choice-active">세로</button>
              <button className="choice">가로</button>
            </div>
            <label className="mb-2 block text-sm font-medium">여백</label>
            <div className="field flex items-center justify-between text-sm">
              <span>10 mm</span>
              <span className="text-stone-400">⌄</span>
            </div>
            <div className="mt-8 rounded-xl bg-[#f8f4ed] p-4">
              <p className="text-sm font-medium">작업을 시작해 보세요</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                도구를 선택해 면을 추가하고 나만의 종이 구조물을 만들어 보세요.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default App
