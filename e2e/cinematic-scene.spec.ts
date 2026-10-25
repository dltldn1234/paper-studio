import { expect, test } from '@playwright/test'

test.use({ video: 'on' })

test('plays the real WebGL sequence and preserves immediate editor access', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.cinematic-canvas canvas')).toBeVisible()
  await expect(
    page.getByText('01 — THE BLUEPRINT', { exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/cinematic-01-blueprint.png' })
  await expect(
    page.getByText('02 — THE CONSTRUCTION', { exact: true }),
  ).toBeVisible()
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'test-results/cinematic-02-construction.png' })
  await expect(
    page.getByText('03 — THE AWAKENING', { exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/cinematic-03-assembled.png' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'test-results/cinematic-04-roar.png' })
  await expect(
    page.getByText('PAPER TYRANNOSAURUS · ORIGINAL PROCEDURAL STUDY', {
      exact: true,
    }),
  ).toBeVisible({ timeout: 10000 })
  await page.screenshot({
    path: 'test-results/cinematic-05-hero.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: '펼치기 / 접기' }).click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'test-results/cinematic-06-unfold.png' })
  await page.getByRole('button', { name: '다시 보기' }).click()
  await expect(
    page.getByText('01 — THE BLUEPRINT', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('link', { name: /스튜디오 시작하기/ })
    .first()
    .click()
  await expect(page.locator('.studio-topbar')).toBeVisible()
  await page.screenshot({
    path: 'test-results/cinematic-07-editor-transition.png',
  })
  expect(errors).toEqual([])
})

test('reduced motion starts static on mobile and skip remains available', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(
    page.getByText('PAPER TYRANNOSAURUS · ORIGINAL PROCEDURAL STUDY', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '모션 줄이기' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({
    path: 'test-results/cinematic-mobile.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: '건너뛰기' }).click()
  await page
    .getByRole('link', { name: /스튜디오 시작하기/ })
    .first()
    .click()
  await expect(page.locator('.studio-topbar')).toBeVisible()
})
