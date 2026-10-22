import { expect, test } from '@playwright/test'
import {
  PDFArray,
  PDFDocument,
  PDFRawStream,
  PrintScaling,
  decodePDFRawStream,
} from 'pdf-lib'

const PDF_POINTS_PER_MM = 72 / 25.4

test('downloads a measured A3 calibration sheet and preserves physical verification status', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/')
  await page.getByRole('button', { name: '내보내기' }).click()
  await page.getByLabel('파일 형식').selectOption('pdf')
  await page.getByLabel('PDF 용지 크기').selectOption('A3')
  await page.getByLabel('PDF 방향').selectOption('landscape')
  await expect(
    page.getByText(/PDF 인쇄 배율은 실제 크기\/100%로 설정/),
  ).toBeVisible()

  const panel = page.getByRole('region', { name: '프린터 교정 프로필' })
  await page.getByLabel('새 프로필 이름').fill('Advanced sheet test')
  await page.getByRole('button', { name: '프로필 만들기' }).click()
  const accuracy = panel.getByRole('region', {
    name: '고급 교정 시트 정확도 검사',
  })
  await accuracy.getByLabel('정밀 시트 X축 실측값').fill('99.5')
  await accuracy.getByLabel('정밀 시트 Y축 실측값').fill('100.8')
  await accuracy.getByLabel('정밀 시트 대각선 실측값').fill('142.6')
  await accuracy.getByLabel('정밀 시트 좌우 정렬 오차').fill('-0.6')
  await accuracy.getByLabel('정밀 시트 상하 정렬 오차').fill('0.2')
  await expect(accuracy.getByText(/입력한 실측 오차/)).toBeVisible()
  await expect(
    accuracy.getByText(/물리 검증 상태는 별도로 업데이트해야 합니다/),
  ).toBeVisible()
  await accuracy.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: '/tmp/paper-studio-phase9-advanced-calibration-sheet.png',
    fullPage: true,
  })

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'PDF 다운로드' }).click()
  const download = await downloadPromise
  const path = await download.path()
  if (!path) throw new Error('Advanced calibration PDF has no temporary file')
  await download.saveAs(
    '/tmp/paper-studio-phase9-advanced-calibration-sheet.pdf',
  )
  const { readFile } = await import('node:fs/promises')
  const document = await PDFDocument.load(await readFile(path))
  const sheet = document.getPages().at(-1)
  expect(sheet).toBeDefined()
  expect(sheet?.getWidth()).toBeCloseTo(420 * PDF_POINTS_PER_MM, 4)
  expect(sheet?.getHeight()).toBeCloseTo(297 * PDF_POINTS_PER_MM, 4)
  expect(
    document.catalog.getOrCreateViewerPreferences().getPrintScaling(),
  ).toBe(PrintScaling.None)

  const contents = sheet?.node.Contents()
  const items = contents instanceof PDFArray ? contents.asArray() : [contents]
  const commands = items
    .filter((item) => item !== undefined)
    .map((item) => document.context.lookup(item))
    .filter((item): item is PDFRawStream => item instanceof PDFRawStream)
    .map((stream) =>
      new TextDecoder().decode(decodePDFRawStream(stream).decode()),
    )
    .join('\n')
  const encodedText = (value: string) =>
    Array.from(new TextEncoder().encode(value), (byte) =>
      byte.toString(16).padStart(2, '0'),
    )
      .join('')
      .toUpperCase()
  const numericCommands = commands.replace(/<[^>]*>/g, '')
  const values = (numericCommands.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const hasMmCoordinate = (millimeters: number) =>
    values.some(
      (value) => Math.abs(value - millimeters * PDF_POINTS_PER_MM) < 0.001,
    )
  expect(commands).toContain(encodedText('PRINTABLE AREA'))
  expect(commands).toContain(encodedText('CUT REFERENCE'))
  expect(commands).toContain(encodedText('150 mm line'))
  expect(commands).toContain(encodedText('150 mm Y'))
  expect(commands).toContain(encodedText('141.42 mm diagonal'))
  expect(hasMmCoordinate(30)).toBe(true)
  expect(hasMmCoordinate(167)).toBe(true)
  expect(hasMmCoordinate(180)).toBe(true)
})
