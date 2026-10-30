import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react'
import { resolveAppRoute } from './app-route'

const Landing = lazy(() => import('./home/Home'))
const Showcase = lazy(() => import('./landing/CinematicLanding'))
const Studio = lazy(() => import('./App'))

function subscribeToLocation(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

function getPathname() {
  return window.location.pathname
}

function RouteLoading() {
  return (
    <main className="route-loading" aria-live="polite">
      <span className="route-loading__mark" aria-hidden="true" />
      <span>Paper Studio</span>
    </main>
  )
}

function NotFound() {
  return (
    <main className="route-not-found">
      <span className="route-not-found__eyebrow">PAPER STUDIO</span>
      <h1>페이지를 찾을 수 없습니다.</h1>
      <p>홈으로 돌아가거나 스튜디오를 바로 열어 보세요.</p>
      <div className="route-not-found__actions">
        <a href="/">홈으로</a>
        <a href="/studio">스튜디오 열기</a>
      </div>
    </main>
  )
}

export default function Application() {
  const pathname = useSyncExternalStore(
    subscribeToLocation,
    getPathname,
    () => '/',
  )
  const route = resolveAppRoute(pathname)

  useEffect(() => {
    const pageMetadata = {
      landing: {
        title: 'Paper Studio — 종이 구조 설계',
        description:
          '전개도를 그리고 접어 보며, 종이 구조의 완성된 형태를 실시간 3D로 확인하세요.',
      },
      showcase: {
        title: 'Paper Studio — 종이 위의 상상을 구조로',
        description: 'Paper Studio의 종이 구조와 접힘을 탐험하세요.',
      },
      studio: {
        title: 'Paper Studio — 구조물 설계 스튜디오',
        description:
          '종이 구조물을 설계하고 전개도, 3D 미리보기와 출력용 도면을 만드세요.',
      },
      'not-found': {
        title: '페이지를 찾을 수 없습니다 — Paper Studio',
        description: 'Paper Studio 홈 또는 구조물 설계 스튜디오로 이동하세요.',
      },
    }[route]
    document.title = pageMetadata.title
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )
    description?.setAttribute('content', pageMetadata.description)
  }, [route])

  if (route === 'showcase')
    return (
      <Suspense fallback={<RouteLoading />}>
        <Showcase />
      </Suspense>
    )
  if (route === 'not-found') return <NotFound />

  return (
    <Suspense fallback={<RouteLoading />}>
      {route === 'studio' ? <Studio /> : <Landing />}
    </Suspense>
  )
}
