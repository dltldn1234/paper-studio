export type AppRoute = 'landing' | 'studio' | 'not-found'

export function resolveAppRoute(pathname: string): AppRoute {
  if (pathname === '/') return 'landing'
  if (pathname === '/studio' || pathname === '/studio/') return 'studio'
  return 'not-found'
}
