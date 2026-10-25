import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LANDING_PAUSE_EVENT, mountLandingMotion } from './landingMotion'
import { saveMotionPreferences } from '../persistence/motion-preferences'

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

it('keeps fallback content visible, syncs motion preferences and releases pending work', () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('hover'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  )
  const pending = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    pending.set(++id, callback)
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((key) => {
    pending.delete(key)
  })
  const flush = () => {
    const current = [...pending]
    pending.clear()
    current.forEach(([, callback]) => callback(0))
  }
  document.body.innerHTML =
    '<main><article data-motion-reveal data-motion-depth><a href="/studio">Studio</a></article></main>'
  const root = document.querySelector('main')!
  const card = document.querySelector('article')!
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 200,
    height: 100,
  } as DOMRect)
  const motion = mountLandingMotion(root)
  expect(card.dataset.revealed).toBe('true')
  root.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }))
  card.dispatchEvent(
    new MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 25 }),
  )
  flush()
  expect(card.style.getPropertyValue('--tilt-y')).toBe('1.5deg')
  motion.setPaused(true)
  expect(root.dataset.pageMotion).toBe('paused')
  expect(card.style.getPropertyValue('--tilt-y')).toBe('')
  motion.setPaused(false)
  saveMotionPreferences({ reduce: true })
  expect(root.dataset.pageMotion).toBe('reduced')
  saveMotionPreferences({ reduce: false })
  expect(root.dataset.pageMotion).toBe('active')
  window.dispatchEvent(new Event('scroll'))
  expect(pending.size).toBe(1)
  motion.dispose()
  motion.dispose()
  expect(pending.size).toBe(0)
  window.dispatchEvent(new Event('scroll'))
  expect(pending.size).toBe(0)
  expect(root.dataset.pageMotion).toBeUndefined()
  window.dispatchEvent(
    new CustomEvent(LANDING_PAUSE_EVENT, { detail: { paused: true } }),
  )
  expect(root.dataset.pageMotion).toBeUndefined()
})
