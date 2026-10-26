import { expect, test } from '@playwright/test'

test('pauses the intro, skips immediately and remembers completed playback', async ({
  page,
}) => {
  await page.goto('/showcase')
  await expect(
    page.getByText('01 — THE BLUEPRINT', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '일시정지' }).click()
  await page.waitForTimeout(2300)
  await expect(
    page.getByText('01 — THE BLUEPRINT', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '재생', exact: true }).click()
  await page.getByRole('button', { name: '건너뛰기' }).click()
  await expect(page.locator('.landing-page')).toHaveAttribute(
    'data-intro-phase',
    'idle',
  )
  await page.reload()
  await expect(page.locator('.cinematic-canvas canvas')).toBeVisible()
  await expect(page.locator('.landing-page')).toHaveAttribute(
    'data-intro-phase',
    'idle',
  )
  await page.getByRole('button', { name: '다시 보기' }).click()
  await expect(page.locator('.landing-page')).toHaveAttribute(
    'data-intro-phase',
    'blueprint',
  )
})

test('supports keyboard rotation, explicit unfold feedback and opt-in sound', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/showcase')
  const canvas = page.locator('.cinematic-canvas canvas')
  await expect(canvas).toBeVisible()
  const before = await canvas.screenshot()
  await canvas.focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(100)
  expect((await canvas.screenshot()).equals(before)).toBe(false)
  await page.keyboard.press('Home')
  await page.getByRole('button', { name: '펼치기 / 접기' }).click()
  await expect(
    page.getByRole('button', { name: '펼치기 / 접기' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '펼치기 / 접기' }).click()
  await expect(
    page.getByRole('button', { name: '펼치기 / 접기' }),
  ).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '소리 꺼짐' }).click()
  await expect(page.getByRole('button', { name: '소리 켜짐' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('keeps scene controls and page content inside narrow and wide viewports', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/showcase')
  await expect(page.locator('.cinematic-canvas canvas')).toBeVisible()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expect(
      page.getByRole('button', { name: '시점 초기화' }),
    ).toBeVisible()
  }
})

test('recovers a failed scene module download to the static hero', async ({
  page,
}) => {
  await page.route('**/src/landing/HeroScene.tsx*', (route) => route.abort())
  await page.goto('/showcase')
  await expect(page.locator('.cinematic-fallback img')).toBeVisible()
  await page.locator('.cinematic-fallback a').click()
  await expect(page.locator('.studio-topbar')).toBeVisible()
})
