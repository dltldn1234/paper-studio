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
