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
