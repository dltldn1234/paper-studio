import { expect, test } from '@playwright/test'

test('shows history statistics, environment filters and retained outlier warnings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/')
  await page.getByRole('button', { name: '내보내기' }).click()
  await page.getByLabel('파일 형식').selectOption('pdf')
  const panel = page.getByRole('region', { name: '프린터 교정 프로필' })
  await page.getByLabel('새 프로필 이름').fill('Statistics test printer')
  await page.getByLabel('프린터 제조사').fill('Maker')
  await page.getByLabel('프린터 모델').fill('M1')
  await page.getByLabel('드라이버 또는 출력 경로').fill('Driver A')
  await page.getByRole('button', { name: '프로필 만들기' }).click()

  const historyInput = page.getByLabel('이력 실측값')
  const addButton = page.getByRole('button', { name: '이력 추가' })
  await page.getByLabel('이력 기준 길이').selectOption('100')
  for (const [axis, value] of [
    ['x', '100'],
    ['x', '100.1'],
    ['y', '108'],
  ] as const) {
    await page.getByLabel('이력 측정 축').selectOption(axis)
    await historyInput.fill(value)
    await addButton.click()
  }

  const analysis = panel.getByRole('region', { name: '측정 정확도 분석' })
  await expect(analysis.getByText('측정 횟수')).toBeVisible()
  await expect(analysis.getByText('3', { exact: true })).toBeVisible()
  await expect(analysis.getByText(/이상치 1건/)).toBeVisible()
  await expect(
    analysis.locator('.accuracy-analysis__point.is-outlier'),
  ).toHaveCount(1)
  await expect(
    analysis.getByText(/원본 이력은 보존되며 자동 삭제되지 않습니다/),
  ).toBeVisible()
  await analysis.getByLabel('통계 드라이버').selectOption('Driver A')
  await expect(analysis.getByText('3', { exact: true })).toBeVisible()
  await analysis.getByLabel('통계 출력 방향').selectOption('portrait')
  await expect(analysis.getByText('3', { exact: true })).toBeVisible()
  await analysis.getByLabel('통계 측정 축').selectOption('x')
  await expect(analysis.getByText('2', { exact: true })).toBeVisible()
  await analysis.getByLabel('통계 측정 축').selectOption('all')
  await analysis.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: '/tmp/paper-studio-phase9-statistical-analysis.png',
    fullPage: true,
  })
})
