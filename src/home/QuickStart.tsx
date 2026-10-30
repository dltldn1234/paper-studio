import { Plus, Layers3, FolderOpen, BookOpen, ArrowUpRight } from 'lucide-react'
export function QuickStart({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="home-quick" data-motion-reveal aria-label="빠른 시작">
      {[
        {
          icon: Plus,
          title: '새 프로젝트',
          description: '빈 설계에서 시작하기',
          action: onCreate,
        },
        {
          icon: Layers3,
          title: '템플릿 탐색',
          description: '기본 형태에서 가능성 찾기',
          action: () => document.getElementById('templates')?.scrollIntoView(),
        },
        {
          icon: FolderOpen,
          title: '최근 프로젝트',
          description: '이어서 작업하기',
          action: () => document.getElementById('recent')?.scrollIntoView(),
        },
        {
          icon: BookOpen,
          title: '시작 가이드',
          description: '첫 설계까지 네 단계',
          action: () => document.getElementById('guide')?.scrollIntoView(),
        },
      ].map(({ icon: Icon, title, description, action }) => (
        <button key={title} data-motion-reveal onClick={action}>
          <span className="home-quick-icon">
            <Icon size={21} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <ArrowUpRight size={17} />
        </button>
      ))}
    </section>
  )
}
