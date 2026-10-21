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

test('exports a local WebP face texture to PDF in the browser', async ({
  page,
}) => {
  await page.goto('/')
  const webpDataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 4
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context is unavailable')
    context.clearRect(0, 0, 4, 4)
    context.fillStyle = '#ff0000'
    context.fillRect(0, 0, 2, 4)
    return canvas.toDataURL('image/webp')
  })
  expect(webpDataUrl).toMatch(/^data:image\/webp;base64,/)
  await page.getByLabel('로컬 이미지 텍스처').setInputFiles({
    name: 'texture.webp',
    mimeType: 'image/webp',
    buffer: Buffer.from(webpDataUrl.split(',')[1], 'base64'),
  })
  await page.getByRole('button', { name: '내보내기' }).click()
  await page.getByLabel('파일 형식').selectOption('pdf')
  await page.screenshot({
    path: '/tmp/paper-studio-phase7-webp-pdf.png',
    fullPage: true,
  })
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF 다운로드' }).click()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('Textured PDF has no temporary file')
  const { readFile } = await import('node:fs/promises')
  expect((await readFile(path)).subarray(0, 4).toString()).toBe('%PDF')
})

test('steps through an idealized assembly guide', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '조립 순서 시작' }).click()
  await expect(page.locator('.assembly-guide__step')).toContainText('단계 1 /')
  await expect(
    page.locator('.net-canvas__face.is-assembly-target'),
  ).toHaveCount(1)
  await expect(page.locator('.assembly-guide__warning')).toContainText(
    'Physical assembly',
  )
  await page.getByRole('button', { name: '조립 다음 단계' }).click()
  const progress = page.getByRole('slider', { name: '접힘 진행률' })
  await expect
    .poll(async () => Number(await progress.getAttribute('value')))
    .toBeGreaterThan(0)
  await page.screenshot({
    path: '/tmp/paper-studio-phase6-assembly-guide.png',
    fullPage: true,
  })
})

test('restores the saved assembly guide position', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '조립 순서 시작' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '프로젝트 저장' }).click()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('Project download has no temporary file')

  await page.getByLabel('프로젝트 파일').setInputFiles(path)
  await expect(page.locator('.assembly-guide__step')).toContainText('단계 1 /')
})

test('configures production print layers and downloads the assembly PDF', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: '내보내기' }).click()
  await page.getByLabel('파일 형식').selectOption('pdf')
  await expect(page.locator('.print-preview-pattern__fold')).not.toHaveCount(0)
  await page.getByLabel('접힘선 표시').uncheck()
  await expect(page.locator('.print-preview-pattern__fold')).toHaveCount(0)
  await page.getByLabel('조립 번호 표시').uncheck()
  await expect(page.locator('.print-preview-pattern__face-number')).toHaveCount(
    0,
  )
  await page.screenshot({
    path: '/tmp/paper-studio-phase6-production-print.png',
    fullPage: true,
  })

  await page.getByLabel('파일 형식').selectOption('guide-pdf')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF 다운로드' }).click()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('Assembly guide PDF has no temporary file')
  const { readFile } = await import('node:fs/promises')
  const bytes = await readFile(path)
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
})
