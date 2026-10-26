import { expect, test } from '@playwright/test'
import { INTRO_DURATION } from '../src/scene/IntroTimeline'

test('plays layered audio only after opt-in and synchronizes the visible roar', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = AudioContext.prototype.createOscillator
    Object.defineProperty(AudioContext.prototype, 'createOscillator', {
      value: function (this: AudioContext) {
        const monitor = window as Window & { roarVoices?: number }
        monitor.roarVoices = (monitor.roarVoices ?? 0) + 1
        return original.call(this)
      },
    })
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/showcase')
  await expect(page.locator('.cinematic-canvas canvas')).toBeVisible()
  expect(
    await page.evaluate(
      () => (window as Window & { roarVoices?: number }).roarVoices ?? 0,
    ),
  ).toBe(0)
  await page.getByRole('button', { name: '소리 꺼짐' }).click()
  await expect(
    page.getByText('03 — THE AWAKENING', { exact: true }),
  ).toBeVisible({ timeout: INTRO_DURATION * 2000 })
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { roarVoices?: number }).roarVoices ?? 0,
      ),
    )
    .toBe(3)
  await page.screenshot({ path: 'test-results/colossal-roar-impact.png' })
  await page.getByRole('button', { name: '소리 켜짐' }).click()
  await expect(page.getByRole('button', { name: '소리 꺼짐' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  expect(errors).toEqual([])
})
