import { expect, test, type Page } from '@playwright/test'
import type { PickBanState } from '../app/utils/api'
import { INTRO_MS, LEAD_MS, T0, asSpectator, iso, pickBanState, readAt, started } from '../app/components/pages/events/pickban/pickBanFixtures'
import { STREAM_EVENT, idleHotState, streamHotState, streamMatch } from '../app/components/stream/data/streamFixtures'
import { expectSceneScreenshot, openScene, scenePath, type StreamFakeApi } from './streamHarness'

const AT = T0 - 60_000

const LOBBY: PickBanState = asSpectator(
    pickBanState({ ready: { team_a: { id: '1000', display_name: 'Ada', at: iso(AT - 30_000) }, team_b: null } }),
)

function renamed(state: PickBanState, matchId: string, a: string, b: string): PickBanState {
    return {
        ...state,
        id: `session-${matchId}`,
        match: { ...state.match, id: matchId },
        teams: { team_a: { ...state.teams.team_a!, name: a }, team_b: { ...state.teams.team_b!, name: b } },
    }
}

const SECOND = renamed(LOBBY, 'match-2', 'Golden Geese', 'Violet Voles')
const CURRENT = streamHotState({ reason: 'current', match: streamMatch({ id: 'match-1', reason: 'current', pick_ban_status: 'lobby' }) })
const NEXT = streamHotState({ reason: 'next', match: streamMatch({ id: 'match-2', reason: 'next', pick_ban_status: 'lobby' }) })
const PICK_BAN = { 'match-1': LOBBY, 'match-2': SECOND }

test('the Pick & Ban scene shows the pick/ban view of the resolved match', async ({ page }) => {
    await openScene(page, 'pick-ban', { hotState: CURRENT, pickBan: PICK_BAN, at: AT })

    await expect(page.locator('[data-stream-scene="pick-ban"]')).toHaveAttribute('data-stream-match', 'match-1')
    await expect(page.getByRole('region', { name: 'Crimson Cats' })).toBeVisible()
    await expect(page.getByText('Lobby open')).toBeVisible()
    await expect(page.getByText('Not ready')).toBeVisible()
    await expect(page.getByText(STREAM_EVENT.name)).toBeVisible()

    await expectSceneScreenshot(page, 'pick-ban.png')
})

test('the Pick & Ban scene names the team currently choosing', async ({ page }) => {
    const at = T0 + LEAD_MS + INTRO_MS + 1_000
    await openScene(page, 'pick-ban', { hotState: CURRENT, pickBan: { 'match-1': asSpectator(readAt(started(), at)) }, at })

    await expect(page.getByText('Currently choosing')).toBeVisible()
    await expect(page.getByText(/on the clock/i)).toHaveCount(0)
})

test('the Pick & Ban scene follows the resolved match without a reload, and falls back to the idle frame', async ({ page }) => {
    const api = await openScene(page, 'pick-ban', { hotState: CURRENT, pickBan: PICK_BAN, at: AT })
    await expect(page.getByRole('region', { name: 'Crimson Cats' })).toBeVisible()
    await page.evaluate(() => { (window as unknown as { sameDocument: boolean }).sameDocument = true })

    api.setHotState(NEXT)
    await expect(page.locator('[data-stream-scene="pick-ban"]')).toHaveAttribute('data-stream-match', 'match-2')
    await expect(page.getByRole('region', { name: 'Golden Geese' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Crimson Cats' })).toHaveCount(0)

    api.setHotState(idleHotState())
    await expect(page.locator('[data-scene-idle]')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Golden Geese' })).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument)).toBe(true)
})

test('the idle frame shows branding only when nothing is resolved', async ({ page }) => {
    await openScene(page, 'pick-ban', { hotState: idleHotState() })

    const idle = page.locator('[data-scene-idle]')
    await expect(idle).toHaveAttribute('data-stream-scene', 'pick-ban')
    await expect(idle.getByText(STREAM_EVENT.name)).toBeVisible()
    await expect(idle.getByRole('img', { name: 'UTBT' })).toBeVisible()
    await expect(page.locator('[data-scene-ticker]')).toHaveCount(0)

    await expectSceneScreenshot(page, 'idle.png')
})

test('motion=0 turns scene motion off and the default keeps it on', async ({ page }) => {
    await openScene(page, 'pick-ban', { hotState: idleHotState(), query: 'sound=0&motion=0' })
    await expect(page.locator('[data-scene-idle]')).toBeVisible()
    await expect(page.locator('[data-motion]').first()).toHaveAttribute('data-motion', 'off')

    await page.goto(scenePath('pick-ban', 'sound=0'))
    await expect(page.locator('[data-scene-idle]')).toBeVisible()
    await expect(page.locator('[data-motion]').first()).toHaveAttribute('data-motion', 'on')
})

async function settledRequests(api: StreamFakeApi, page: Page): Promise<number> {
    await expect(page.locator('[data-scene-idle]')).toBeVisible()
    await page.waitForTimeout(1_000)
    return api.hotStateRequests()
}

test('an OBS source stays on the hidden cadence, then refetches the hot state as soon as it goes on program', async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { obsstudio: object }).obsstudio = {} })
    const api = await openScene(page, 'pick-ban', { hotState: idleHotState() })
    const loaded = await settledRequests(api, page)
    await page.waitForTimeout(4_000)
    expect(api.hotStateRequests()).toBe(loaded)

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('obsSourceActiveChanged', { detail: { active: true } })))
    await expect.poll(() => api.hotStateRequests(), { timeout: 1_000 }).toBe(loaded + 1)
    await expect.poll(() => api.hotStateRequests(), { timeout: 5_000 }).toBeGreaterThanOrEqual(loaded + 3)
})

test('preview=1 keeps the hidden cadence outside OBS', async ({ page }) => {
    const api = await openScene(page, 'pick-ban', { hotState: idleHotState(), query: 'sound=0&motion=0&preview=1' })
    const loaded = await settledRequests(api, page)
    await page.waitForTimeout(5_000)
    expect(api.hotStateRequests()).toBe(loaded)
})

test('a scene outside OBS polls the hot state at the active cadence', async ({ page }) => {
    const api = await openScene(page, 'pick-ban', { hotState: idleHotState() })
    const loaded = await settledRequests(api, page)
    await expect.poll(() => api.hotStateRequests(), { timeout: 5_000 }).toBeGreaterThanOrEqual(loaded + 2)
})
