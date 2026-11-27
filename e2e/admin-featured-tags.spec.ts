import { expect, test, type Locator, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'

const VIEWER = { id: '555555555555', alias: 'Rin' }
const ROLE_MODERATOR = 1
const ROLE_CUP_ADMIN = 3
const SAVED = 'Saved. The in-game mapvote shows it within a minute.'

interface Server {
  role: number
  tags: string[]
  available: string[]
  featuredFailure: { status: number; error: string } | null
  puts: unknown[]
  putError: string | null
}

const AVAILABLE = [
  'classic',
  'easy',
  'Halloween',
  'hard',
  'long',
  'puzzle',
  'remake',
  'speed',
  'team',
  'Winter Cup 2026',
]

async function mockApi(page: Page, overrides: Partial<Server> = {}): Promise<Server> {
  const server: Server = {
    role: ROLE_MODERATOR,
    tags: ['Winter Cup 2026', 'Halloween', 'classic'],
    available: AVAILABLE,
    featuredFailure: null,
    puts: [],
    putError: null,
    ...overrides,
  }

  await page.addInitScript(() => {
    localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
    localStorage.setItem('utbt:adminState:v1', JSON.stringify({ activeSection: 'featured-tags' }))
    localStorage.setItem(
      'utbt:webAuth:v1',
      JSON.stringify({
        discordId: '555555555555',
        username: 'rin',
        avatar: '',
        accessToken: 'admin-token',
        refreshToken: 'admin-refresh',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      })
    )
  })

  await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.hostname === 'gateway.utbt.net') {
      await route.fulfill({ json: [] })
      return
    }
    const path = url.pathname.replace(/\/$/, '')
    const method = request.method()

    if (path === '/admin/mapvote/featured' && method === 'GET') {
      if (server.featuredFailure) {
        await route.fulfill({
          status: server.featuredFailure.status,
          json: { success: false, error: server.featuredFailure.error },
        })
        return
      }
      await route.fulfill({ json: { success: true, data: { tags: server.tags, available: server.available } } })
      return
    }
    if (path === '/admin/mapvote/featured' && method === 'PUT') {
      const body = request.postDataJSON() as { tags: string[] }
      server.puts.push(body)
      if (server.putError) {
        await route.fulfill({ status: 400, json: { success: false, error: server.putError } })
        return
      }
      server.tags = body.tags.map((tag) => tag.trim())
      await route.fulfill({ json: { success: true, data: { tags: server.tags } } })
      return
    }
    if (path === '/users/me') {
      await route.fulfill({ json: { success: true, data: { ...VIEWER, utbt_role: server.role, twitch_url: null } } })
      return
    }
    if (path === '/user_state') {
      await route.fulfill({ json: { success: true, data: { state: {}, seen: {}, updated_at: null } } })
      return
    }
    if (path === '/launcher/activity/latest') {
      await route.fulfill({ status: 404, json: { success: false, error: 'Not found' } })
      return
    }
    if (path === '/v2/summary') {
      await route.fulfill({
        json: {
          success: true,
          data: {
            global: { newMaps: 0, newRecords: 0 },
            achievements: [],
            recentWorldRecords: [],
            newMaps: [],
            latestPatch: null,
          },
        },
      })
      return
    }
    await route.fulfill({ json: { success: true, data: [] } })
  })

  return server
}

async function openFeaturedTags(page: Page) {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Featured Tags', exact: true })).toBeVisible()
  return {
    list: page.getByRole('list', { name: 'Featured Tags' }),
    search: page.getByLabel('Add a tag'),
    save: page.getByRole('button', { name: 'Save', exact: true }),
    discard: page.getByRole('button', { name: 'Discard', exact: true }),
  }
}

async function order(list: Locator): Promise<string[]> {
  return list.getByRole('listitem').evaluateAll((items) => items.map((item) => item.getAttribute('aria-label') ?? ''))
}

async function centre(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('not rendered')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test('lists the featured tags in order, with their positions', async ({ page }) => {
  await mockApi(page)
  const { list, save, discard } = await openFeaturedTags(page)

  expect(await order(list)).toEqual(['Winter Cup 2026', 'Halloween', 'classic'])
  await expect(list.getByRole('listitem').first()).toContainText('1')
  await expect(list.getByRole('listitem').nth(2)).toContainText('3')
  await expect(save).toBeDisabled()
  await expect(discard).toBeDisabled()
})

test('dragging a row by its handle reorders the list and enables Save', async ({ page }) => {
  await mockApi(page)
  const { list, save } = await openFeaturedTags(page)

  const from = await centre(list.getByRole('button', { name: 'Reorder classic' }))
  const to = await centre(list.getByRole('listitem', { name: 'Winter Cup 2026' }))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x, to.y, { steps: 8 })
  await page.mouse.up()

  expect(await order(list)).toEqual(['classic', 'Winter Cup 2026', 'Halloween'])
  await expect(save).toBeEnabled()
})

test('a touch drag on the handle reorders the list', async ({ page, browserName, hasTouch }) => {
  test.skip(browserName !== 'chromium' || !hasTouch, 'needs a Chromium touch screen')
  await mockApi(page)
  const { list } = await openFeaturedTags(page)

  const from = await centre(list.getByRole('button', { name: 'Reorder Winter Cup 2026' }))
  const to = await centre(list.getByRole('listitem', { name: 'classic' }))
  const touch = await page.context().newCDPSession(page)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] })
  for (let step = 1; step <= 8; step++) {
    const y = from.y + ((to.y - from.y) * step) / 8
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y }] })
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

  await expect.poll(() => order(list)).toEqual(['Halloween', 'classic', 'Winter Cup 2026'])
})

test('the arrow keys on a handle move the tag one place', async ({ page }) => {
  await mockApi(page)
  const { list } = await openFeaturedTags(page)

  const handle = list.getByRole('button', { name: 'Reorder Halloween' })
  await handle.focus()
  await handle.press('ArrowUp')
  expect(await order(list)).toEqual(['Halloween', 'Winter Cup 2026', 'classic'])
  await expect(handle).toBeFocused()

  await handle.press('ArrowUp')
  expect(await order(list)).toEqual(['Halloween', 'Winter Cup 2026', 'classic'])

  await handle.press('ArrowDown')
  await handle.press('ArrowDown')
  expect(await order(list)).toEqual(['Winter Cup 2026', 'classic', 'Halloween'])
})

test('the type-ahead suggests only tags that are not featured yet, matched case-insensitively', async ({ page }) => {
  await mockApi(page)
  const { list, search } = await openFeaturedTags(page)
  const matches = page.getByRole('list', { name: 'Matching tags' })

  await search.fill('E')
  await expect(matches.getByRole('button')).toHaveText(['easy', 'puzzle', 'remake', 'speed', 'team'])
  await expect(matches.getByRole('button', { name: 'Halloween' })).toHaveCount(0)
  await expect(matches.getByRole('button', { name: 'Winter Cup 2026' })).toHaveCount(0)

  await search.fill('REM')
  await matches.getByRole('button', { name: 'remake' }).click()
  expect(await order(list)).toEqual(['Winter Cup 2026', 'Halloween', 'classic', 'remake'])
  await expect(search).toHaveValue('')
  await expect(search).toBeFocused()

  await search.fill('winter')
  await expect(page.getByText('No tag left to add matches “winter”.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Add new tag/ })).toHaveCount(0)
})

test('Enter adds the tag the search names, with its exact name, and never an unknown one', async ({ page }) => {
  await mockApi(page)
  const { list, search } = await openFeaturedTags(page)
  const add = page.getByRole('button', { name: 'Add', exact: true })

  await search.fill('brand new tag')
  await expect(add).toBeDisabled()
  await search.press('Enter')
  expect(await order(list)).toEqual(['Winter Cup 2026', 'Halloween', 'classic'])

  await search.fill('SPEED')
  await expect(add).toBeEnabled()
  await search.press('Enter')
  expect(await order(list)).toEqual(['Winter Cup 2026', 'Halloween', 'classic', 'speed'])
})

test('removing a tag takes it off the list and offers it again', async ({ page }) => {
  await mockApi(page)
  const { list, search, save } = await openFeaturedTags(page)

  await list.getByRole('button', { name: 'Remove Halloween' }).click()
  expect(await order(list)).toEqual(['Winter Cup 2026', 'classic'])
  await expect(save).toBeEnabled()

  await search.fill('hallo')
  await expect(
    page.getByRole('list', { name: 'Matching tags' }).getByRole('button', { name: 'Halloween' })
  ).toBeVisible()
})

test('Save sends the whole list in order and shows the saved list', async ({ page }) => {
  const server = await mockApi(page)
  const { list, search, save, discard } = await openFeaturedTags(page)

  await list.getByRole('button', { name: 'Remove Winter Cup 2026' }).click()
  await search.fill('team')
  await search.press('Enter')
  await list.getByRole('button', { name: 'Reorder team' }).press('ArrowUp')
  await save.click()

  await expect(page.getByText(SAVED)).toBeVisible()
  expect(server.puts).toEqual([{ tags: ['Halloween', 'team', 'classic'] }])
  expect(await order(list)).toEqual(['Halloween', 'team', 'classic'])
  await expect(save).toBeDisabled()
  await expect(discard).toBeDisabled()
})

test('removing every tag saves an empty list', async ({ page }) => {
  const server = await mockApi(page, { tags: ['classic'] })
  const { list, save } = await openFeaturedTags(page)

  await list.getByRole('button', { name: 'Remove classic' }).click()
  await expect(page.getByText('No featured tags yet.')).toBeVisible()
  await save.click()

  await expect(page.getByText(SAVED)).toBeVisible()
  expect(server.puts).toEqual([{ tags: [] }])
})

test('a refused save shows the reason and keeps the edits', async ({ page }) => {
  const server = await mockApi(page, { putError: 'No active map carries these tags: classic.' })
  const { list, save } = await openFeaturedTags(page)

  await list.getByRole('button', { name: 'Reorder classic' }).press('ArrowUp')
  await save.click()

  await expect(page.getByText('No active map carries these tags: classic.')).toBeVisible()
  expect(await order(list)).toEqual(['Winter Cup 2026', 'classic', 'Halloween'])
  await expect(save).toBeEnabled()
  expect(server.puts).toHaveLength(1)
})

test('Discard goes back to the last loaded list', async ({ page }) => {
  const server = await mockApi(page)
  const { list, search, save, discard } = await openFeaturedTags(page)

  await list.getByRole('button', { name: 'Remove classic' }).click()
  await search.fill('easy')
  await search.press('Enter')
  await list.getByRole('button', { name: 'Reorder easy' }).press('ArrowUp')
  await discard.click()

  expect(await order(list)).toEqual(['Winter Cup 2026', 'Halloween', 'classic'])
  await expect(save).toBeDisabled()
  await expect(discard).toBeDisabled()
  expect(server.puts).toEqual([])
})

test('a featured tag no active map carries is flagged', async ({ page }) => {
  await mockApi(page, { tags: ['classic', 'Retired Event'] })
  const { list } = await openFeaturedTags(page)

  await expect(list.getByRole('listitem', { name: 'Retired Event' }).getByText('No active map')).toBeVisible()
  await expect(list.getByRole('listitem', { name: 'classic' }).getByText('No active map')).toHaveCount(0)
})

test('an empty featured list and no tags to add say so', async ({ page }) => {
  await mockApi(page, { tags: [], available: [] })
  const { search, save } = await openFeaturedTags(page)

  await expect(page.getByText('No featured tags yet.')).toBeVisible()
  await expect(page.getByText('No active map carries a tag yet, so there is nothing to feature.')).toBeVisible()
  await expect(search).toBeDisabled()
  await expect(save).toBeDisabled()
})

test('a failed load offers a retry', async ({ page }) => {
  const server = await mockApi(page, { featuredFailure: { status: 500, error: 'Mapvote settings are unavailable' } })
  await openFeaturedTags(page)

  await expect(page.getByText("Couldn't load the featured tags: Mapvote settings are unavailable")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)

  server.featuredFailure = null
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('list', { name: 'Featured Tags' }).getByRole('listitem')).toHaveCount(3)
})

test('a 403 from the API shows the refusal and no list', async ({ page }) => {
  await mockApi(page, { featuredFailure: { status: 403, error: 'Staff only' } })
  await openFeaturedTags(page)

  await expect(page.getByText("Couldn't load the featured tags: Staff only")).toBeVisible()
  await expect(page.getByRole('list', { name: 'Featured Tags' })).toHaveCount(0)
})

test('a Cup Admin does not see the Featured Tags section', async ({ page }) => {
  await mockApi(page, { role: ROLE_CUP_ADMIN })
  await page.goto('/admin')

  await expect(page.getByText("You don't have permission to view this section.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Featured Tags', exact: true })).toHaveCount(0)
  await expect(page.locator('select:has(option[value="featured-tags"])')).toHaveCount(0)
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1920, height: 1080 },
]) {
  test(`the Featured Tags section fits ${viewport.width} px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await mockApi(page, {
      tags: [
        'Winter Cup 2026',
        'Halloween',
        'classic',
        'A very long featured tag name for the end of season finals weekend',
      ],
    })
    const { list, search } = await openFeaturedTags(page)

    await expect(list.getByRole('listitem')).toHaveCount(4)
    await search.fill('a')
    await expect(page.getByRole('list', { name: 'Matching tags' })).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)

    const remove = await list.getByRole('button', { name: 'Remove classic' }).boundingBox()
    expect(remove?.height ?? 0).toBeGreaterThanOrEqual(32)
  })
}
