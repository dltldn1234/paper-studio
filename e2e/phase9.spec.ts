import { expect, test } from '@playwright/test'

test('manages versioned profile-linked measurement history and JSON backup', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/')
  await page.getByRole('button', { name: '내보내기' }).click()
  await page.getByLabel('파일 형식').selectOption('pdf')
  const panel = page.getByRole('region', { name: '프린터 교정 프로필' })
  await page.getByLabel('새 프로필 이름').fill('History Test')
  await page.getByRole('button', { name: '프로필 만들기' }).click()
  await page.getByLabel('이력 실측값').fill('49.6')
  await page.getByRole('button', { name: '이력 추가' }).click()
  await expect(panel.getByText(/측정 이력 · 1건/)).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const rows = JSON.parse(
          localStorage.getItem('paper-studio.measurement-history.v1') ?? '[]',
        )
        return rows[0]
      }),
    )
    .toMatchObject({
      version: 1,
      profileId: expect.any(String),
      measuredMm: 49.6,
      axis: 'x',
    })

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '이력 JSON 내보내기' }).click()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('Measurement history JSON has no temporary file')
  await page.getByLabel('이력 실측값').fill('50.1')
  await page.getByRole('button', { name: '이력 추가' }).click()
  await page.getByLabel('측정 이력 JSON 가져오기').setInputFiles(path)
  await expect(panel.getByText(/측정 이력 · 2건/)).toBeVisible()

  const historyList = panel.getByLabel('측정 이력 목록')
  await historyList.getByRole('button', { name: '수정' }).first().click()
  await page.getByLabel('이력 실측값').fill('49.9')
  await page.getByRole('button', { name: '이력 수정 저장' }).click()
  await expect(panel.getByText(/49\.9 mm/)).toBeVisible()
  await historyList.getByRole('button', { name: '삭제' }).first().click()
  await expect(panel.getByText(/측정 이력 · 1건/)).toBeVisible()

  await panel.getByRole('button', { name: '기본 프로필 지정' }).click()
  await page.reload()
  await page.getByRole('button', { name: '내보내기' }).click()
  await page.getByLabel('파일 형식').selectOption('pdf')
  const restoredPanel = page.getByRole('region', { name: '프린터 교정 프로필' })
  await expect(restoredPanel.getByText(/측정 이력 · 1건/)).toBeVisible()
  await restoredPanel.getByLabel('측정 이력 목록').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: '/tmp/paper-studio-phase9-measurement-history.png',
    fullPage: false,
  })
})
