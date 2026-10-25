import { expect, test } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'

test('creates a local printer profile and records separate measured axes', async ({
  page,
}) => {
  test.setTimeout(30000)
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/studio')
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
  await page.getByLabel('X축 100 mm 실측값').fill('99')
  await page.getByLabel('X축 100 mm 실측값').press('Tab')
  await page.getByLabel('Y축 50 mm 실측값').fill('50.5')
  await page.getByLabel('Y축 50 mm 실측값').press('Tab')
  await page.getByLabel('Y축 100 mm 실측값').fill('100.8')
  await page.getByLabel('Y축 100 mm 실측값').press('Tab')

  const correction = page.getByLabel('이 프로필의 보정 배율 PDF에 적용')
  await expect(correction).toBeVisible()
  await expect(correction).not.toBeChecked()
  const dialog = page.getByRole('dialog')
  const scrollState = await dialog.evaluate((element) => {
    const before = {
      className: element.className,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      computedHeight: getComputedStyle(element).height,
      maxHeight: getComputedStyle(element).maxHeight,
      overflowY: getComputedStyle(element).overflowY,
    }
    element.scrollTop = element.scrollHeight
    return { ...before, scrollTop: element.scrollTop }
  })
  expect(scrollState.scrollTop).toBeGreaterThan(0)
  await correction.scrollIntoViewIfNeeded()
  await correction.check()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF 다운로드' }).click()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('Calibrated PDF has no temporary file')
  const pdf = await PDFDocument.load(
    await (await import('node:fs/promises')).readFile(path),
  )
  expect(pdf.getSubject()).toContain('Office A4')
  expect(pdf.getPages()[0].getWidth()).toBeCloseTo((210 * 72) / 25.4, 4)

  await page.getByRole('button', { name: '내보내기' }).click()
  await page.getByLabel('파일 형식').selectOption('pdf')

  for (const [axis, target, measured] of [
    ['X', 50, 50],
    ['X', 100, 100],
    ['Y', 50, 50],
    ['Y', 100, 100],
  ] as const) {
    const input = page.getByLabel(`${axis}축 보정 후 ${target} mm 실측값`)
    await input.fill(String(measured))
    await input.press('Tab')
  }
  await expect
    .poll(() =>
      page.evaluate(() => {
        const profiles = JSON.parse(
          localStorage.getItem('paper-studio.printer-profiles.v1') ?? '[]',
        ) as Array<{
          verification: { status: string; physicallyMeasured: boolean }
        }>
        return profiles[0].verification
      }),
    )
    .toMatchObject({ status: 'needs-review', physicallyMeasured: false })
  await page.getByLabel('실제 재출력물을 자로 측정했습니다').check()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const profiles = JSON.parse(
          localStorage.getItem('paper-studio.printer-profiles.v1') ?? '[]',
        ) as Array<{
          verification: { status: string; physicallyMeasured: boolean }
        }>
        return profiles[0].verification
      }),
    )
    .toMatchObject({ status: 'verified', physicallyMeasured: true })

  const profileDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON 내보내기', exact: true }).click()
  const profileDownload = await profileDownloadPromise
  const profilePath = await profileDownload.path()
  if (!profilePath)
    throw new Error('Printer profile JSON has no temporary file')
  const { readFile } = await import('node:fs/promises')
  const exportedProfiles = JSON.parse(await readFile(profilePath, 'utf8')) as {
    profiles: Array<{
      verification: { status: string; physicallyMeasured: boolean }
    }>
  }
  expect(exportedProfiles.profiles[0].verification).toMatchObject({
    status: 'verified',
    physicallyMeasured: true,
  })
  await page
    .getByLabel('프린터 프로필 JSON 가져오기')
    .setInputFiles(profilePath)
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: '프린터 프로필을 가져왔습니다.' }),
  ).toBeVisible()

  await expect
    .poll(() =>
      page.evaluate(() => {
        const profiles = JSON.parse(
          localStorage.getItem('paper-studio.printer-profiles.v1') ?? '[]',
        ) as Array<{
          isDefault: boolean
          xMeasurements: Array<{ targetMm: number; measuredMm: number }>
          yMeasurements: Array<{ targetMm: number; measuredMm: number }>
          correction: { xScale: number; yScale: number } | null
        }>
        return profiles[0]
      }),
    )
    .toMatchObject({
      isDefault: true,
      xMeasurements: [
        { targetMm: 50, measuredMm: 49.5 },
        { targetMm: 100, measuredMm: 99 },
      ],
      yMeasurements: [
        { targetMm: 50, measuredMm: 50.5 },
        { targetMm: 100, measuredMm: 100.8 },
      ],
      correction: { xScale: expect.any(Number), yScale: expect.any(Number) },
    })

  await panel.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: '/tmp/paper-studio-phase8-printer-profiles.png',
    fullPage: false,
  })
  await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.screenshot({
    path: '/tmp/paper-studio-phase8-calibration-verification.png',
    fullPage: false,
  })
})
