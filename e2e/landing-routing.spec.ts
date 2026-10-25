import { expect, test } from '@playwright/test'

test('root route introduces Paper Studio and links to the real editor', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      name: '종이 위의 상상이, 현실의 구조가 되다.',
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /스튜디오 시작하기/ }).first(),
  ).toHaveAttribute('href', '/studio')
  await expect(
    page.getByRole('heading', { name: '설계부터 종이 위의 완성까지.' }),
  ).toBeVisible()
  await page.screenshot({
    path: 'test-results/landing-foundation-desktop.png',
    fullPage: true,
  })
})

test('direct studio route keeps the existing CAD editor available', async ({
  page,
}) => {
  await page.goto('/studio')

  await expect(page.locator('.studio-topbar')).toBeVisible()
  await expect(page.getByLabel('다면체 종류')).toBeVisible()
  await expect(page).toHaveTitle('Paper Studio — 구조물 설계 스튜디오')
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('heading', {
      name: '종이 위의 상상이, 현실의 구조가 되다.',
    }),
  ).toBeVisible()
})

test('unknown routes explain the next valid destinations', async ({ page }) => {
  await page.goto('/unknown')

  await expect(
    page.getByRole('heading', { name: '페이지를 찾을 수 없습니다.' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: '스튜디오 열기' }),
  ).toHaveAttribute('href', '/studio')
  await expect(page).toHaveTitle('페이지를 찾을 수 없습니다 — Paper Studio')
})
