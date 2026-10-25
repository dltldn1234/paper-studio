import { expect, test } from '@playwright/test'

test('coordinates scroll reveals, pointer depth and full-page playback preferences', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')
  const root = page.locator('.landing-page')
  await expect(root).toHaveAttribute('data-page-motion', 'active')
  await page.getByRole('button', { name: '일시정지' }).click()
  await expect(root).toHaveAttribute('data-page-motion', 'paused')
  await expect(page.locator('#landing-title')).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: '재생', exact: true }).click()
  await page.getByRole('button', { name: '건너뛰기' }).click()
  const steps = page.locator('.landing-workflow__steps')
  await steps.scrollIntoViewIfNeeded()
  await expect(steps).toHaveAttribute('data-revealed', 'true')
  const card = steps.locator('li').first()
  await expect(card).toHaveCSS('opacity', '1')
  const bounds = await card.boundingBox()
  await page.mouse.move(
    bounds!.x + bounds!.width * 0.8,
    bounds!.y + bounds!.height * 0.35,
  )
  await expect
    .poll(() =>
      card.evaluate((element) => element.style.getPropertyValue('--tilt-y')),
    )
    .not.toBe('')
  await page.screenshot({ path: 'test-results/page-motion-workflow.png' })
  const preview = page.locator('.landing-product figure')
  await preview.scrollIntoViewIfNeeded()
  await expect(preview).toHaveAttribute('data-motion-visible', 'true')
  await expect(page.locator('.landing-product__scan')).toHaveCSS(
    'animation-play-state',
    'running',
  )
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'test-results/page-motion-product.png' })
  const progress = await root.evaluate((element) =>
    Number(element.style.getPropertyValue('--page-progress')),
  )
  expect(progress).toBeGreaterThan(0.3)
  await page.getByRole('button', { name: '일시정지' }).click()
  await expect(root).toHaveAttribute('data-page-motion', 'paused')
  await expect(page.locator('.landing-product__scan')).toHaveCSS(
    'animation-play-state',
    'paused',
  )
  await page.getByRole('button', { name: '재생', exact: true }).click()
  await page.getByRole('button', { name: '모션 줄이기' }).click()
  await expect(root).toHaveAttribute('data-page-motion', 'reduced')
  await preview.scrollIntoViewIfNeeded()
  await expect(preview).toHaveCSS('transform', 'none')
  await expect(page.locator('.landing-product__scan')).toHaveCSS(
    'animation-name',
    'none',
  )
  await page.getByRole('link', { name: '이 샘플 직접 열기' }).click()
  await expect(page.getByLabel('다면체 종류')).toHaveValue('tetrahedron')
})

test('keeps mobile content readable with system reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.landing-page')).toHaveAttribute(
    'data-page-motion',
    'reduced',
  )
  await page.locator('.landing-product').scrollIntoViewIfNeeded()
  await expect(page.locator('.landing-product figure')).toHaveCSS(
    'opacity',
    '1',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/page-motion-mobile-reduced.png',
    fullPage: true,
  })
})
