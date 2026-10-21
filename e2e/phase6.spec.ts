import { expect, test } from '@playwright/test'

test('edits glue tab shape and edge state', async ({ page }) => {
  await page.goto('/')
  const shape = page.getByRole('combobox', { name: '접착탭 형태' })
  const direction = page.getByRole('combobox', { name: '접착탭 방향' })
  await shape.selectOption('beveled')
  await direction.selectOption('inward')

  const tabs = page.locator('[data-tab-id]')
  await expect(tabs).toHaveCount(7)
  const edgeToggle = page.getByRole('checkbox', { name: /접착탭$/ }).first()
  await edgeToggle.uncheck()
  await expect(tabs).toHaveCount(6)

  await page.screenshot({
    path: '/tmp/paper-studio-phase6-glue-tabs.png',
    fullPage: true,
  })
})

test('loads a local face texture and captures its editor state', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'kraft 재질 프리셋' }).click()
  await page.getByLabel('로컬 이미지 텍스처').setInputFiles({
    name: 'texture.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await expect(page.getByLabel('텍스처 크기')).toBeVisible()
  await expect(page.locator('[data-face-id="front"]')).toHaveAttribute(
    'style',
    /url\(/,
  )
  await page.screenshot({
    path: '/tmp/paper-studio-phase6-material-texture.png',
    fullPage: true,
  })
})
