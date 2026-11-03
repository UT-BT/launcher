import { expect, test, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { readRecording } from './fixtures/recording'
import { serveFixtureSet } from './fixtures/router'
import { crawlSurfaces, surfaceSteps } from './manifest'
import { home } from './manifest/home'
import { CONSENT_KEY } from './manifest/overlays'
import { settleLayout } from './settle'

const PHONE = { width: 390, height: 844 }

interface RecordedWorldRecord {
    mapName: string
    members?: { alias: string }[] | null
}

function recordedTeamRecord(): RecordedWorldRecord {
    const summary = readRecording(home.fixtures).responses.find(response => /^\/v2\/summary\/?$/.test(response.path))
    const records = (summary?.body as { data?: { recentWorldRecords?: RecordedWorldRecord[] } } | undefined)?.data?.recentWorldRecords ?? []
    const team = records.find(record => (record.members?.length ?? 0) > 1)
    if (!team) throw new Error('the home fixture has no team world record')
    return team
}

async function openHome(page: Page) {
    await page.addInitScript(key => localStorage.setItem(key, 'denied'), CONSENT_KEY)
    await serveFixtureSet(page, home.fixtures)
    const surface = crawlSurfaces('pr').find(candidate => candidate.id === home.view)
    if (!surface) throw new Error(`no crawl surface for ${home.view}`)
    const { path, steps } = surfaceSteps(surface)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(path)
        for (const step of steps) await step(page)
    })
    await settleLayout(page)
}

test.describe('Home latest world records cards', () => {
    test.use({ viewport: PHONE, contextOptions: { screen: PHONE } })

    test('a team record card names every member', async ({ page }) => {
        const team = recordedTeamRecord()
        await openHome(page)
        const list = page.getByRole('main').getByRole('list', { name: 'Latest world records' })
        await expect(list).toBeVisible()
        const card = list.getByRole('listitem').filter({ has: page.getByRole('img', { name: team.mapName, exact: true }) })
        await expect(card).toHaveCount(1)
        for (const member of team.members ?? []) {
            await expect(card.getByText(member.alias, { exact: true })).toBeVisible()
        }
    })
})
