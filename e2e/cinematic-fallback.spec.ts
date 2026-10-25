import { expect, test } from '@playwright/test'

test('offers a static original poster and editor entry without WebGL', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (
        this: HTMLCanvasElement,
        type: string,
        ...args: unknown[]
      ) {
        if (type.startsWith('webgl')) return null
        return Reflect.apply(original, this, [type, ...args])
      },
    })
  })
  await page.goto('/')
  await expect(page.locator('.cinematic-fallback img')).toBeVisible()
  await expect(page.locator('.landing-page')).toHaveAttribute(
    'data-intro-phase',
    'idle',
  )
  await page.locator('.cinematic-fallback a').click()
  await expect(page.locator('.studio-topbar')).toBeVisible()
})

test('recovers a lost WebGL context to the poster without blocking navigation', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.cinematic-canvas canvas')).toBeVisible()
  await page
    .locator('.cinematic-canvas canvas')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    )
  await expect(page.locator('.cinematic-fallback img')).toBeVisible()
  await page.locator('.cinematic-fallback a').click()
  await expect(page.locator('.studio-topbar')).toBeVisible()
})
