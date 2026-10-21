import { expect, test } from '@playwright/test'

test('shows preflight warnings for a low-resolution texture before PDF export', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/')
  await page.getByRole('button', { name: '내보내기' }).click()
  await page.getByLabel('파일 형식').selectOption('pdf')
  const report = page.getByRole('region', { name: 'PDF 사전 검사 결과' })
  await expect(report).toContainText('PDF 사전 검사')

  await page.getByLabel('로컬 이미지 텍스처').setInputFiles({
    name: 'tiny.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await expect(report).toContainText('경고')
  await expect(report).toContainText('150 DPI')
  await page.screenshot({
    path: '/tmp/paper-studio-phase7-preflight.png',
    fullPage: true,
  })

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF 다운로드' }).click()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('Preflighted PDF has no temporary file')
  const { readFile } = await import('node:fs/promises')
  expect((await readFile(path)).subarray(0, 4).toString()).toBe('%PDF')
})
