import { describe, expect, it } from 'vitest'
import { resolveAppRoute } from './app-route'

describe('resolveAppRoute', () => {
  it('opens the landing page at the root route', () => {
    expect(resolveAppRoute('/')).toBe('landing')
  })

  it('preserves the studio route with or without a trailing slash', () => {
    expect(resolveAppRoute('/studio')).toBe('studio')
    expect(resolveAppRoute('/studio/')).toBe('studio')
  })

  it('does not silently treat unknown URLs as editor routes', () => {
    expect(resolveAppRoute('/unknown')).toBe('not-found')
  })
})
