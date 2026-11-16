import { expect, test, type Locator, type Page } from '@playwright/test'
import { dataFrom, replyFor } from './mobile/fixtures/data'
import { fixtureSetNamed } from './mobile/fixtures'
import { serveFixtureSet } from './mobile/fixtures/router'
import { maps } from './mobile/manifest/maps'

const MAPS_LIST = (url: URL) => /^(api|gateway)\.utbt\.net$/.test(url.hostname) && url.pathname.replace(/\/$/, '') === '/maps'
const TUTORIAL_KEY = 'utbt:mapsPageTutorial:v1'

interface MapAuthorFields {
    name: string
    author?: string | number | null
    author_str?: string | null
    author_ref?: string | null
}

async function openMaps(page: Page, { tutorialSeen = true }: { tutorialSeen?: boolean } = {}) {
    await page.addInitScript(({ storage, tutorialSeen, tutorialKey }) => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        for (const [key, value] of Object.entries(storage)) {
            if (key !== tutorialKey || tutorialSeen) localStorage.setItem(key, value)
        }
    }, { storage: maps.storage ?? {}, tutorialSeen, tutorialKey: TUTORIAL_KEY })
    await serveFixtureSet(page, maps.fixtures)
}

async function gotoMaps(page: Page) {
    await page.goto(maps.path)
    await maps.ready(page, dataFrom(fixtureSetNamed(maps.fixtures)!))
}

async function editAuthors(page: Page, edit: (map: MapAuthorFields) => void) {
    const set = fixtureSetNamed(maps.fixtures)!
    await page.route(MAPS_LIST, async route => {
        const reply = replyFor(set, new URL(route.request().url()))
        if (!reply) return route.fallback()
        const json = structuredClone(reply.json) as { data: MapAuthorFields[] }
        json.data.forEach(edit)
        await route.fulfill({ status: reply.status ?? 200, json })
    })
}

function row(page: Page, mapName: string): Locator {
    return page.getByRole('main').getByRole('row').filter({ hasText: mapName })
}

function tooltip(page: Page): Locator {
    return page.locator('body > div.fixed.w-max')
}

async function centreOffset(inner: Locator, outer: Locator): Promise<number> {
    const a = (await inner.boundingBox())!
    const b = (await outer.boundingBox())!
    return Math.abs((a.x + a.width / 2) - (b.x + b.width / 2))
}

test.describe('Maps author and Demos tooltips on a pointer device', () => {
    test.skip(({ isMobile }) => isMobile, 'hover tooltips are for pointer devices')

    test('hovering a linked author shows "View player profile" above it, and a click opens the profile', async ({ page }) => {
        await openMaps(page)
        await gotoMaps(page)
        const author = row(page, 'Qamariya-v2').getByRole('link', { name: 'Xclusive' })
        await author.hover()
        await expect(tooltip(page)).toHaveText('View player profile')
        const tip = (await tooltip(page).boundingBox())!
        const name = (await author.boundingBox())!
        expect(tip.y + tip.height).toBeLessThanOrEqual(name.y)
        await author.click()
        await expect(page).toHaveURL(/\/players\/260007417478250497$/)
    })

    test('a string-only author and the placeholder show no tooltip', async ({ page }) => {
        await openMaps(page)
        await editAuthors(page, map => {
            if (map.name === 'CTF-BT-HumanResources') map.author_ref = null
            if (map.name === 'CTF-BT-(Fran)PureJump') {
                map.author = null
                map.author_str = null
                map.author_ref = null
            }
        })
        await gotoMaps(page)

        const plain = row(page, 'HumanResources').getByText('Zanmato', { exact: true })
        await expect(plain).toBeVisible()
        await expect(row(page, 'HumanResources').getByRole('link', { name: 'Zanmato' })).toHaveCount(0)
        await plain.hover()
        await expect(tooltip(page)).toHaveCount(0)

        const placeholder = row(page, 'PureJump').getByText('—', { exact: true })
        await expect(placeholder).toBeVisible()
        await placeholder.hover()
        await expect(tooltip(page)).toHaveCount(0)
    })

    test('hovering Demos shows "Browse demos" above it, and a click opens the demo picker of that map, not the map', async ({ page }) => {
        await openMaps(page)
        await gotoMaps(page)
        const demos = row(page, 'Qamariya-v2').getByRole('button', { name: 'Demos', exact: true })
        await demos.hover()
        await expect(tooltip(page)).toHaveText('Browse demos')
        const tip = (await tooltip(page).boundingBox())!
        const button = (await demos.boundingBox())!
        expect(tip.y + tip.height).toBeLessThanOrEqual(button.y)
        await demos.click()
        await expect(page.getByText(/^Replays — Qamariya-v2$/)).toBeVisible()
        await expect(page).toHaveURL(/\/maps(\?.*)?$/)
    })

    test('the author name and the Demos button stay centred in their cells', async ({ page }) => {
        await openMaps(page)
        await gotoMaps(page)
        const author = row(page, 'Qamariya-v2').getByRole('link', { name: 'Xclusive' })
        const authorCell = row(page, 'Qamariya-v2').getByRole('cell').filter({ has: page.getByRole('link', { name: 'Xclusive' }) })
        expect(await centreOffset(author, authorCell)).toBeLessThanOrEqual(1)
        const demos = row(page, 'Qamariya-v2').getByRole('button', { name: 'Demos', exact: true })
        const demosCell = row(page, 'Qamariya-v2').getByRole('cell').filter({ has: page.getByRole('button', { name: 'Demos', exact: true }) })
        expect(await centreOffset(demos, demosCell)).toBeLessThanOrEqual(1)
    })

    test("the tutorial's demos step still highlights the first row's Demos button", async ({ page }) => {
        await openMaps(page, { tutorialSeen: false })
        await gotoMaps(page)
        await page.getByRole('button', { name: 'Start tutorial' }).click()
        const tutorial = page.getByRole('dialog', { name: 'Maps page tutorial' })
        for (let i = 0; i < 20 && !(await tutorial.getByText('Watch demos').isVisible()); i++) {
            await tutorial.getByRole('button', { name: 'Next' }).click()
        }
        await expect(tutorial.getByText('Watch demos')).toBeVisible()
        const highlighted = page.locator('[data-tutorial-highlight]')
        await expect(highlighted).toHaveCount(1)
        await expect(highlighted).toHaveText('Demos')
        await expect(highlighted).toHaveJSProperty('tagName', 'BUTTON')
    })
})
