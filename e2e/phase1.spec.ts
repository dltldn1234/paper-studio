import { expect, test } from '@playwright/test'

test('dimensions update the 2D net, 3D preview, and inspector together', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')

  await expect(
    page.getByRole('img', { name: 'Three.js 직육면체 3D 미리보기' }),
  ).toBeVisible()
  await page.getByLabel('너비 (mm)', { exact: true }).fill('120')

  await expect(page.getByText('W 120', { exact: false })).toBeVisible()
  await expect(page.locator('[data-face-id="front"]')).toHaveAttribute(
    'aria-label',
    '앞면, 120 × 60 mm',
  )
  await expect(
    page.locator('.selected-face-card').getByText('120 × 60 mm'),
  ).toBeVisible()
  await expect(page.locator('.three-preview__canvas')).toBeVisible()
  await page.screenshot({
    path: 'test-results/phase1-editor-desktop.png',
    fullPage: true,
  })
})

test('rejects invalid dimensions while keeping the last valid model', async ({
  page,
}) => {
  await page.goto('/')
  const width = page.getByLabel('너비 (mm)', { exact: true })
  await width.fill('0')

  await expect(width).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('alert')).toContainText('0.1 mm 이상')
  await expect(page.locator('[data-face-id="front"]')).toHaveAttribute(
    'aria-label',
    '앞면, 100 × 60 mm',
  )
})

test('supports SVG zoom, pan, and keyboard face selection', async ({
  page,
}) => {
  await page.goto('/')
  const svg = page.getByRole('application', { name: '2D 전개도 캔버스' })
  const face = page.locator('[data-face-id="right"]')

  await page.getByRole('button', { name: '확대' }).click()
  await expect(page.locator('.net-canvas__controls output')).toHaveText('120%')
  await page.getByRole('button', { name: '축소' }).click()
  await expect(page.locator('.net-canvas__controls output')).toHaveText('100%')

  await face.focus()
  await page.keyboard.press('Enter')
  await expect(face).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.selected-face-card')).toContainText('오른쪽 면')

  const before = await svg.getAttribute('viewBox')
  const box = await svg.boundingBox()
  if (!box) throw new Error('2D SVG canvas has no rendered bounds')
  await page.mouse.move(box.x + 20, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 58, box.y + 42)
  await page.mouse.up()
  await expect.poll(() => svg.getAttribute('viewBox')).not.toBe(before)
})

test('selects a face from the 3D canvas and adapts to a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  const canvas = page.locator('.three-preview__canvas')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('3D canvas has no rendered bounds')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator('.selected-face-card')).not.toContainText('앞면')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole('region', { name: '2D 전개도 편집기' }),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: '속성 인스펙터' }),
  ).toBeVisible()
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.locator('body').evaluate((element) => element.clientWidth),
  )
})
