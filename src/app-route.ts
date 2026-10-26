export type AppRoute = 'landing' | 'showcase' | 'studio' | 'not-found'

export function resolveAppRoute(pathname: string): AppRoute {
  if (pathname === '/') return 'landing'
  if (pathname === '/showcase' || pathname === '/showcase/') return 'showcase'
  if (pathname === '/studio' || pathname === '/studio/') return 'studio'
  return 'not-found'
}
