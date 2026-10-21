import { expect, test } from '@playwright/test'

test('creates a local printer profile and records separate measured axes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/')
  await page.getByRole('button', { name: '내보내기' }).click()
  await page.getByLabel('파일 형식').selectOption('pdf')
  const panel = page.getByRole('region', { name: '프린터 교정 프로필' })
  await expect(panel).toBeVisible()

  await page.getByLabel('새 프로필 이름').fill('Office A4')
  await page.getByLabel('프린터 제조사').fill('Paper Maker')
  await page.getByLabel('프린터 모델').fill('Model 8')
  await page.getByLabel('드라이버 또는 출력 경로').fill('macOS AirPrint')
  await page.getByRole('button', { name: '프로필 만들기' }).click()
  await expect(page.getByLabel('현재 용지 프로필')).toContainText('Office A4')
  await page.getByRole('button', { name: '기본 프로필 지정' }).click()

  await page.getByLabel('X축 50 mm 실측값').fill('49.5')
  await page.getByLabel('X축 50 mm 실측값').press('Tab')
  await page.getByLabel('Y축 100 mm 실측값').fill('100.8')
  await page.getByLabel('Y축 100 mm 실측값').press('Tab')

  await expect
    .poll(() =>
      page.evaluate(() => {
        const profiles = JSON.parse(
          localStorage.getItem('paper-studio.printer-profiles.v1') ?? '[]',
        ) as Array<{
          isDefault: boolean
          xMeasurements: Array<{ targetMm: number; measuredMm: number }>
          yMeasurements: Array<{ targetMm: number; measuredMm: number }>
        }>
        return profiles[0]
      }),
    )
    .toMatchObject({
      isDefault: true,
      xMeasurements: [{ targetMm: 50, measuredMm: 49.5 }],
      yMeasurements: [{ targetMm: 100, measuredMm: 100.8 }],
    })

  await panel.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: '/tmp/paper-studio-phase8-printer-profiles.png',
    fullPage: false,
  })
})
