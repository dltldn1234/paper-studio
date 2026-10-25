import { expect, test } from '@playwright/test'

test('sample entry uses a separate draft and restores the original workspace', async ({
  page,
}) => {
  await page.goto('/studio')
  await page
    .getByRole('spinbutton', { name: '너비 (mm)', exact: true })
    .fill('143')
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  await page.getByRole('link', { name: /샘플 프로젝트 열기/ }).click()
  await expect(page).toHaveURL('/studio?sample=tetrahedron')
  await expect(page.getByLabel('다면체 종류')).toHaveValue('tetrahedron')
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  await page
    .getByRole('link', { name: /스튜디오 시작하기/ })
    .first()
    .click()
  await expect(page.getByLabel('다면체 종류')).toHaveValue('cuboid')
  await expect(
    page.getByRole('spinbutton', { name: '너비 (mm)', exact: true }),
  ).toHaveValue('143')
})
