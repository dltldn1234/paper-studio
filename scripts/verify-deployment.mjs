import process from 'node:process'
import console from 'node:console'
import { URL } from 'node:url'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const url = new URL(process.argv[2])
const cookieHeaders = process.argv[3]
const label = process.argv[4] ?? 'deployment'
const browser = await chromium.launch()
const cookies = []
if (cookieHeaders) {
  const headers = await readFile(cookieHeaders, 'utf8')
  for (const line of headers.split('\n')) {
    if (!line.toLowerCase().startsWith('set-cookie:')) continue
    const pair = line
      .slice(line.indexOf(':') + 1)
      .trim()
      .split(';')[0]
    const separator = pair.indexOf('=')
    cookies.push({
      name: pair.slice(0, separator),
      value: pair.slice(separator + 1),
      url: url.origin,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    })
  }
}
const errors = []
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    recordVideo: {
      dir: `test-results/${label}-video`,
      size: { width: 1280, height: 720 },
    },
  })
  await context.addCookies(cookies)
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(url.href)
  await page.locator('.cinematic-canvas canvas').waitFor()
  await page.screenshot({ path: `test-results/${label}-blueprint.png` })
  await page
    .getByText('02 — THE CONSTRUCTION', { exact: true })
    .waitFor({ timeout: 20000 })
  await page.waitForTimeout(650)
  await page.screenshot({ path: `test-results/${label}-construction.png` })
  await page
    .getByText('03 — THE AWAKENING', { exact: true })
    .waitFor({ timeout: 20000 })
  await page.waitForTimeout(950)
  await page.screenshot({ path: `test-results/${label}-roar.png` })
  await page
    .getByText('PAPER TYRANNOSAURUS · ORIGINAL PROCEDURAL STUDY', {
      exact: true,
    })
    .waitFor({ timeout: 20000 })
  await page.screenshot({
    path: `test-results/${label}-hero.png`,
    fullPage: true,
  })
  await page
    .getByRole('link', { name: /스튜디오 시작하기/ })
    .first()
    .click()
  await page.locator('.studio-topbar').waitFor()
  assert.equal(new URL(page.url()).pathname, '/studio')
  await page.screenshot({ path: `test-results/${label}-editor.png` })
  await page.goto(new URL('/studio?sample=tetrahedron', url).href)
  assert.equal(await page.getByLabel('다면체 종류').inputValue(), 'tetrahedron')
  await context.close()
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })
  await mobile.addCookies(cookies)
  const mobilePage = await mobile.newPage()
  mobilePage.on('pageerror', (error) => errors.push(error.message))
  await mobilePage.goto(url.href)
  await mobilePage
    .getByText('PAPER TYRANNOSAURUS · ORIGINAL PROCEDURAL STUDY', {
      exact: true,
    })
    .waitFor()
  assert.equal(
    await mobilePage.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
    true,
  )
  await mobilePage.screenshot({
    path: `test-results/${label}-mobile.png`,
    fullPage: true,
  })
  await mobile.close()
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify(
      {
        url: url.origin,
        cinematic: 'passed',
        studio: 'passed',
        directSample: 'passed',
        mobileReducedMotion: 'passed',
        pageErrors: errors.length,
        evidence: `test-results/${label}-*`,
      },
      null,
      2,
    ),
  )
} finally {
  await browser.close()
}
