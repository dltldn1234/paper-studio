import { expect, test } from '@playwright/test'

test('creates separate projects, restores edits after reload and supports browser history', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: '한 장의 종이에서, 입체가 깨어나다.' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: '새 설계 시작하기', exact: true })
    .click()
  await expect(page).toHaveURL('/studio')
  await page
    .getByRole('spinbutton', { name: '너비 (mm)', exact: true })
    .fill('147')
  await page.reload()
  await expect(
    page.getByRole('spinbutton', { name: '너비 (mm)', exact: true }),
  ).toHaveValue('147')
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  await expect(page.locator('.home-project')).toHaveCount(1)
  await page.getByRole('button', { name: /정사면체 네 개의/ }).click()
  await expect(page.getByLabel('다면체 종류')).toHaveValue('tetrahedron')
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  await expect(page.locator('.home-project')).toHaveCount(2)
  await page
    .locator('.home-project-open')
    .filter({ hasText: '직육면체 프로젝트' })
    .click()
  await expect(
    page.getByRole('spinbutton', { name: '너비 (mm)', exact: true }),
  ).toHaveValue('147')
  await page.goBack()
  await expect(page.locator('.home-project')).toHaveCount(2)
  await page.goForward()
  await expect(
    page.getByRole('spinbutton', { name: '너비 (mm)', exact: true }),
  ).toHaveValue('147')
  expect(errors).toEqual([])
})

test('opens all supported templates directly in the real geometry editor', async ({
  page,
}) => {
  for (const [kind, label] of [
    ['cuboid', '직육면체 패키지'],
    ['cube', '정육면체 균형'],
    ['tetrahedron', '정사면체 네 개'],
    ['octahedron', '정팔면체 입체적인'],
  ]) {
    await page.goto('/')
    await page.getByRole('button', { name: new RegExp(label) }).click()
    await expect(page.getByLabel('다면체 종류')).toHaveValue(kind)
    await expect(page.locator('.studio-topbar')).toBeVisible()
  }
})

test('renames, searches and confirms deletion of actual projects', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('button', { name: '새 설계 시작하기', exact: true })
    .click()
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  await page.waitForLoadState('load')
  await expect(page).toHaveURL('/')
  await expect(page.locator('.home-project')).toHaveCount(1)
  await page.waitForTimeout(500)
  const renameButton = page.getByRole('button', {
    name: '직육면체 프로젝트 이름 변경',
  })
  await renameButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByLabel('새 프로젝트 이름').fill('종이 파빌리온')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await page.reload()
  await page.getByLabel('프로젝트 검색').fill('없는 이름')
  await expect(page.getByText('검색 결과가 없습니다.')).toBeVisible()
  await page.getByLabel('프로젝트 검색').fill('파빌리온')
  await expect(page.locator('.home-project')).toHaveCount(1)
  await page.getByRole('button', { name: '종이 파빌리온 삭제' }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.home-project')).toHaveCount(1)
  await page.getByRole('button', { name: '종이 파빌리온 삭제' }).click()
  await page.getByRole('button', { name: '삭제 확인' }).click()
  await expect(page.locator('.home-project')).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '한 장의 종이에서, 입체가 깨어나다.' }),
  ).toBeVisible()
})

test('imports compatible JSON and rejects malformed files without changing stored projects', async ({
  page,
}) => {
  await page.goto('/studio?sample=tetrahedron')
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  const sample = await page.evaluate(() =>
    localStorage.getItem('paper-studio.editor-sample.v1')!,
  )
  await page.getByLabel('홈 프로젝트 파일').setInputFiles({
    name: 'saved.paperstudio.json',
    mimeType: 'application/json',
    buffer: Buffer.from(sample),
  })
  await expect(page.getByLabel('다면체 종류')).toHaveValue('tetrahedron')
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  await page.getByLabel('홈 프로젝트 파일').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  })
  await expect(page.getByRole('alert')).toContainText('손상된 프로젝트')
  await expect(page.locator('.home-project')).toHaveCount(1)
})

test('preserves corrupt library bytes and reports unavailable browser storage', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('paper-studio.projects.v1', 'original damaged data'),
  )
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('데이터는 보존')
  await page
    .getByRole('button', { name: '새 설계 시작하기', exact: true })
    .click()
  await expect(page).toHaveURL('/')
  expect(
    await page.evaluate(() => localStorage.getItem('paper-studio.projects.v1')),
  ).toBe('original damaged data')
})

test('blocks home navigation after a quota failure and keeps JSON backup available', async ({
  page,
}) => {
  await page.goto('/studio')
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError')
    }
  })
  await page
    .getByRole('spinbutton', { name: '너비 (mm)', exact: true })
    .fill('159')
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  await expect(page).toHaveURL('/studio')
  await expect(page.getByRole('alert')).toContainText(
    '자동 저장하지 못했습니다',
  )
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '프로젝트 저장', exact: true }).click()
  expect((await download).suggestedFilename()).toContain('.paperstudio.json')
})

for (const width of [320, 390, 768, 1440]) {
  test(`home is usable at ${width}px with reduced motion and keyboard controls`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 960 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '입체가 깨어나다.',
    )
    const sceneCanvas = page.locator(
      '.home-hero-scene .cinematic-canvas canvas',
    )
    const sceneFallback = page.locator('.cinematic-fallback')
    await expect(sceneCanvas.or(sceneFallback)).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    if (await sceneCanvas.isVisible()) {
      const foldToggle = page.getByRole('button', { name: '펼치기 / 접기' })
      await expect(
        page.getByRole('button', { name: '모션 줄이기' }),
      ).toHaveAttribute('aria-pressed', 'true')
      await foldToggle.click()
      await expect(foldToggle).toHaveText('입체로 접기')
      await foldToggle.click()
      await expect(foldToggle).toHaveText('전개도 펼치기')
      await page.getByRole('button', { name: '다시 보기' }).focus()
      await page.keyboard.press('Enter')
    } else {
      await expect(sceneFallback).toBeVisible()
    }
    await page.getByRole('button', { name: '설정', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.screenshot({
      path: `test-results/home-experience-${width}.png`,
      fullPage: true,
    })
    expect(errors).toEqual([])
  })
}

test('plays the hero fold sequence when motion is enabled', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(false)
  await expect(
    page.locator('.home-hero-scene .cinematic-canvas canvas'),
  ).toBeVisible({
    timeout: 5000,
  })
  await expect(page.locator('.cinematic-showcase')).toHaveAttribute(
    'data-phase',
    'blueprint',
    { timeout: 5000 },
  )
  await page.waitForTimeout(3200)
  await expect(page.locator('.cinematic-showcase')).toHaveAttribute(
    'data-phase',
    'construction',
  )
  await page.screenshot({ path: 'test-results/home-motion-1440.png' })
  await page.getByRole('button', { name: '다시 보기' }).click()
  await expect(page.locator('.cinematic-showcase')).toHaveAttribute(
    'data-phase',
    'blueprint',
  )
  expect(errors).toEqual([])
})

test('migrates a legacy version-one draft into recent projects without losing geometry', async ({
  page,
}) => {
  await page.goto('/studio?sample=tetrahedron')
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  await page.evaluate(() => {
    const project = JSON.parse(
      localStorage.getItem('paper-studio.editor-sample.v1')!,
    )
    project.version = 1
    project.name = '이전 버전 설계'
    project.edgeLengthMm = 123
    delete project.faceMaterials
    delete project.assemblyStepIndex
    delete project.assemblyGuideActive
    localStorage.setItem(
      'paper-studio.editor-workspace.v1',
      JSON.stringify(project),
    )
  })
  await page.reload()
  await page
    .locator('.home-project-open')
    .filter({ hasText: '이전 버전 설계' })
    .click()
  await expect(page.getByLabel('다면체 종류')).toHaveValue('tetrahedron')
  await expect(
    page.getByRole('spinbutton', { name: '모서리 길이 (mm)', exact: true }),
  ).toHaveValue('123')
})

test('retains independent project data when two editor tabs save in succession', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await page
    .getByRole('button', { name: '새 설계 시작하기', exact: true })
    .click()
  await expect(page.getByLabel('다면체 종류')).toBeVisible()
  const firstId = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('paper-studio.projects.v1')!).activeId,
  )
  const second = await context.newPage()
  await second.goto('/')
  await second
    .getByRole('button', { name: '새 설계 시작하기', exact: true })
    .click()
  await second
    .getByRole('spinbutton', { name: '너비 (mm)', exact: true })
    .fill('188')
  await second.getByRole('link', { name: 'Paper Studio 홈' }).click()
  await page
    .getByRole('spinbutton', { name: '너비 (mm)', exact: true })
    .fill('144')
  await page.getByRole('link', { name: 'Paper Studio 홈' }).click()
  const projects = await page.evaluate(
    () => JSON.parse(localStorage.getItem('paper-studio.projects.v1')!).entries,
  )
  expect(projects).toHaveLength(2)
  expect(
    projects.find((entry: { id: string }) => entry.id === firstId).project
      .dimensions.widthMm,
  ).toBe(144)
  expect(
    projects.find((entry: { id: string }) => entry.id !== firstId).project
      .dimensions.widthMm,
  ).toBe(188)
  await second.close()
})

test('keeps templates and project creation usable without WebGL', async ({
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
        return type.startsWith('webgl')
          ? null
          : Reflect.apply(original, this, [type, ...args])
      },
    })
  })
  await page.goto('/')
  await expect(page.locator('.cinematic-fallback')).toBeVisible()
  await expect(page.locator('.cinematic-fallback img')).toHaveAttribute(
    'src',
    '/paper-dinosaur-poster.jpg',
  )
  await expect(page.locator('.home-template')).toHaveCount(4)
  await page
    .getByRole('button', { name: '새 설계 시작하기', exact: true })
    .click()
  await expect(page.locator('.studio-topbar')).toBeVisible()
})

test('isolates a failed 3D module download from the functional home dashboard', async ({
  page,
}) => {
  await page.route('**/src/landing/HeroScene.tsx*', (route) => route.abort())
  await page.goto('/')
  await expect(page.locator('.cinematic-fallback')).toBeVisible()
  await expect(page.locator('.home-template')).toHaveCount(4)
  await page.getByRole('button', { name: '설정', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: '새 설계 시작하기', exact: true }),
  ).toBeEnabled()
})
