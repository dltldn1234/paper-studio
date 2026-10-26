import { Box, Search, HardDrive, Settings2, ArrowUpRight } from 'lucide-react'
export function HomeHeader({
  query,
  onQueryChange,
  onSettings,
}: {
  query: string
  onQueryChange: (value: string) => void
  onSettings: () => void
}) {
  return (
    <header className="home-header">
      <a className="home-brand" href="/" aria-label="Paper Studio 홈">
        <span>
          <Box size={21} />
        </span>
        paper<span className="home-brand-dot">.</span>studio
      </a>
      <span className="home-header-label">워크스페이스</span>
      <label className="home-search">
        <Search size={16} />
        <input
          aria-label="프로젝트 검색"
          placeholder="프로젝트 검색…"
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value)
            document.getElementById('recent')?.scrollIntoView()
          }}
        />
        <kbd>⌕</kbd>
      </label>
      <details className="home-storage">
        <summary>
          <HardDrive size={15} />
          <span>이 브라우저에 저장</span>
        </summary>
        <p>
          프로젝트는 현재 브라우저에 자동 저장됩니다. 브라우저 데이터를 삭제하면
          사라질 수 있으니 에디터의 프로젝트 저장으로 JSON 파일을 보관하세요.
        </p>
      </details>
      <button
        className="home-icon"
        aria-label="설정"
        onClick={() => onSettings()}
      >
        <Settings2 size={19} />
      </button>
      <a className="home-editor-link" href="/studio">
        에디터 열기 <ArrowUpRight size={15} />
      </a>
    </header>
  )
}
