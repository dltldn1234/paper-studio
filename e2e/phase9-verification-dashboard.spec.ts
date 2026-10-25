import { expect, test } from '@playwright/test'
import { PDFDocument, PrintScaling } from 'pdf-lib'
import { readFile } from 'node:fs/promises'

test('filters profile history and downloads JSON and PDF verification reports', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/studio')
  await page.getByRole('button', { name: '내보내기' }).click()
  await page.getByLabel('파일 형식').selectOption('pdf')
  await page.getByLabel('새 프로필 이름').fill('Report printer')
  await page.getByLabel('프린터 제조사').fill('Maker')
  await page.getByLabel('프린터 모델').fill('Model R')
  await page.getByLabel('드라이버 또는 출력 경로').fill('Driver R')
  await page.getByRole('button', { name: '프로필 만들기' }).click()

  await page.getByLabel('이력 기준 길이').selectOption('100')
  await page.getByLabel('이력 측정 축').selectOption('x')
  await page.getByLabel('이력 종류').selectOption('calibration')
  await page.getByLabel('이력 실측값').fill('99.5')
  await page.getByRole('button', { name: '이력 추가' }).click()

  const dashboard = page.getByRole('region', { name: '검증 대시보드' })
  await dashboard
    .getByLabel('검증 프린터 프로필')
    .selectOption({ label: 'Report printer · A4' })
  await expect(dashboard.getByText('상세 측정 기록 · 1건')).toBeVisible()
  await expect(
    dashboard.getByRole('row').filter({ hasText: '99.50 mm' }),
  ).toBeVisible()
  await expect(dashboard.getByText('미검증', { exact: true })).toBeVisible()

  const jsonDownloadPromise = page.waitForEvent('download')
  await dashboard.getByRole('button', { name: 'JSON 보고서' }).click()
  const jsonDownload = await jsonDownloadPromise
  const jsonPath = await jsonDownload.path()
  if (!jsonPath)
    throw new Error('Verification JSON report has no temporary file')
  const report = JSON.parse(await readFile(jsonPath, 'utf8')) as {
    printer: { name: string; driverInfo: string }
    verification: { status: string; physicallyMeasured: boolean }
    measurements: Array<{
      id: string
      errorMm: number
      driverInfo: string
      orientation: string
    }>
    limitations: string[]
  }
  expect(report.printer).toMatchObject({
    name: 'Report printer',
    driverInfo: 'Driver R',
  })
  expect(report.verification).toMatchObject({
    status: 'unverified',
    physicallyMeasured: false,
  })
  expect(report.measurements).toHaveLength(1)
  expect(report.measurements[0]).toMatchObject({
    errorMm: -0.5,
    driverInfo: 'Driver R',
    orientation: 'portrait',
  })
  expect(report.limitations.join(' ')).toContain(
    'Software cannot validate physical printer output',
  )

  const pdfDownloadPromise = page.waitForEvent('download')
  await dashboard.getByRole('button', { name: 'PDF 보고서' }).click()
  const pdfDownload = await pdfDownloadPromise
  await pdfDownload.saveAs('/tmp/paper-studio-phase9-verification-report.pdf')
  const pdfPath = await pdfDownload.path()
  if (!pdfPath) throw new Error('Verification PDF report has no temporary file')
  const pdf = await PDFDocument.load(await readFile(pdfPath))
  expect(pdf.getTitle()).toContain('Report printer')
  expect(pdf.getPages()[0].getWidth()).toBeCloseTo((210 * 72) / 25.4, 4)
  expect(pdf.catalog.getOrCreateViewerPreferences().getPrintScaling()).toBe(
    PrintScaling.None,
  )

  await dashboard.getByLabel('검증 드라이버 필터').selectOption('Driver R')
  await dashboard.getByLabel('검증 방향 필터').selectOption('portrait')
  await expect(dashboard.getByText('상세 측정 기록 · 1건')).toBeVisible()
  await dashboard.screenshot({
    path: '/tmp/paper-studio-phase9-verification-dashboard.png',
  })
})
