import { expect, test, type Locator, type Page } from '@playwright/test'
import type { PickBanViewState } from '../app/components/pages/events/pickban/pickBanView'
import { pickBanVetoErrorFixture, pickBanVetoFixture } from '../app/utils/fixtures/pickBanVetoFixtures'
import { horizontalOverflow } from './layout'

const SLUG = 'veto-cup'
const MATCH = 'match-1'
const EVENT_NAME = '2v2 World Cup'
const PAGE_PATH = `/events/${SLUG}/matches/${MATCH}`
const STATE_PATH = `/tournaments/${SLUG}/matches/${MATCH}/pick-ban`
const ADMIN_STATE_PATH = `/tournaments/${SLUG}/admin/matches/${MATCH}/pick-ban`
const HARD_MAPS = ['Diplopia-V4', 'FuriumMineCE2', 'InventionCE2', 'Synchronize-vF2']
const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': 'ETag, X-Server-Now',
}

type Side = 'team_a' | 'team_b'

type VetoFixtureName = 'pickBanLobbyVeto' | 'pickBanVetoChoice' | 'pickBanVetoSpotlightVetoed' | 'pickBanVetoSpotlightPlayed' | 'pickBanSideChoiceAfterVeto'

interface Post {
    path: string
    body: unknown
    authorization: string | undefined
}

interface Reply {
    status?: number
    json: unknown
}

interface FakeServer {
    state: PickBanViewState
    since: number
    posts: Post[]
    onPost: (post: Post) => Reply | null
}

function fakeServer(state: PickBanViewState, onPost: FakeServer['onPost'] = () => null): FakeServer {
    return { state, since: Date.now(), posts: [], onPost }
}

function setState(server: FakeServer, state: PickBanViewState) {
    server.state = state
    server.since = Date.now()
}

function serverNowOf(server: FakeServer): string {
    return new Date(Date.parse(server.state.server_now) + (Date.now() - server.since)).toISOString()
}

function vetoState(name: VetoFixtureName): PickBanViewState {
    const fixture = pickBanVetoFixture(name)
    return { ...fixture, match: { ...fixture.match, id: MATCH } }
}

function viewedBy(state: PickBanViewState, side: Side): PickBanViewState {
    return {
        ...state,
        viewer: { roster_captain: true, side },
        capabilities: { ...state.capabilities, acting_side: side, can_manage: false },
    }
}

function managedBy(state: PickBanViewState): PickBanViewState {
    return {
        ...state,
        viewer: { roster_captain: false, side: null },
        capabilities: {
            ...state.capabilities,
            acting_side: null,
            can_manage: true,
            can_veto: false,
            can_choose_side: false,
            can_ready: false,
            can_lock_now: false,
        },
    }
}

function vetoChoiceOfLobby(eligible: Side[]): PickBanViewState {
    const lobby = vetoState('pickBanLobbyVeto')
    const running = vetoState('pickBanVetoSpotlightVetoed')
    return {
        ...lobby,
        ready: running.ready,
        started_at: running.started_at,
        intro_ends_at: running.intro_ends_at,
        current_plan_index: running.current_plan_index,
        match: running.match,
        phase: 'veto_choice',
        status: 'running',
        version: 5,
        server_now: '2026-10-28T19:01:20+00:00',
        capabilities: { ...lobby.capabilities, can_ready: false, can_veto: true },
        veto: {
            ...lobby.veto!,
            eligible,
            choices: Object.fromEntries(eligible.map(side => [side, null])),
        },
    }
}

function sideChoiceAfterVeto(): PickBanViewState {
    return { ...vetoState('pickBanSideChoiceAfterVeto'), version: 7 }
}

function sidesSet(): PickBanViewState {
    const choosing = sideChoiceAfterVeto()
    return {
        ...choosing,
        phase: 'side_spotlight',
        version: 8,
        a_side: 'team_b',
        phase_ends_at: '2026-10-28T19:01:55+00:00',
        plan: choosing.plan.map(step => ({ ...step, side: step.side && (step.side === 'team_a' ? 'team_b' : 'team_a') })),
        teams: { team_a: { ...choosing.teams.team_a!, ab: 'B' }, team_b: { ...choosing.teams.team_b!, ab: 'A' } },
        capabilities: { ...choosing.capabilities, can_choose_side: false },
        side: { ...choosing.side, confirmed: true, red: 'team_b', set_at: '2026-10-28T19:01:46+00:00', source: 'step0' },
    }
}

function accepted(state: PickBanViewState, server: FakeServer): Reply {
    setState(server, state)
    return { json: { success: true, data: { ...state, server_now: serverNowOf(server) } } }
}

async function serve(page: Page, server: FakeServer, role: 'captain' | 'manager' = 'captain') {
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:pickBanMotion:v1', JSON.stringify('off'))
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '2010',
            username: 'captain',
            avatar: '',
            accessToken: 'captain-token',
            refreshToken: 'captain-refresh',
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        }))
    })
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
        const url = new URL(request.url())
        const pathname = url.pathname.replace(/\/$/, '')
        if (pathname === `/tournaments/${SLUG}`) {
            return route.fulfill({ headers: CORS, json: { success: true, data: { tournament: { slug: SLUG, name: EVENT_NAME } } } })
        }
        if (pathname === '/users/me') {
            return route.fulfill({ headers: CORS, json: { success: true, data: { id: '2010', alias: 'Captain', utbt_role: role === 'manager' ? 1 : 0 } } })
        }
        if (pathname === '/user_state') {
            return route.fulfill({ headers: CORS, json: { success: true, data: { state: {}, seen: {}, updated_at: null } } })
        }
        if (pathname === STATE_PATH && request.method() === 'GET') {
            const serverNow = serverNowOf(server)
            const etag = `"v${server.state.version}"`
            const headers = { ...CORS, etag, 'x-server-now': serverNow }
            if (request.headers()['if-none-match'] === etag) return route.fulfill({ status: 304, headers })
            return route.fulfill({ status: 200, headers, json: { success: true, data: { ...server.state, server_now: serverNow } } })
        }
        if (pathname.startsWith(STATE_PATH + '/') || pathname.startsWith(ADMIN_STATE_PATH + '/')) {
            const post = { path: pathname, body: request.postDataJSON(), authorization: request.headers().authorization }
            server.posts.push(post)
            const reply = server.onPost(post)
            if (reply) return route.fulfill({ status: reply.status ?? 200, headers: CORS, json: reply.json })
            return route.fulfill({ status: 404, headers: CORS, json: { success: false, error: 'No handler' } })
        }
        return route.fulfill({ headers: CORS, json: { success: true, data: [] } })
    })
}

const stage = (page: Page) => page.getByLabel('Picks & Bans Stage')
const controls = (page: Page) => page.getByLabel('Your team’s controls')
const steps = (page: Page) => page.getByLabel('Steps')

async function chooseCard(group: Locator, name: string | RegExp) {
    await group.getByRole('radio', { name }).click()
}

test('an eligible captain vetoes the Hard maps, sees the outcome, then picks a side from cards on 9 maps', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const choosing = viewedBy(vetoChoiceOfLobby(['team_b']), 'team_b')
    const vetoed = vetoState('pickBanVetoSpotlightVetoed')
    const server = fakeServer(choosing, post => {
        if (post.path.endsWith('/veto')) return accepted(vetoed, server)
        if (post.path.endsWith('/side')) return accepted(sidesSet(), server)
        return null
    })
    await serve(page, server)
    await page.goto(PAGE_PATH)

    const hardMaps = page.getByRole('radiogroup', { name: 'Hard maps' })
    await expect(controls(page).getByText('Veto or play the Hard maps')).toBeVisible()
    await expect(hardMaps.getByRole('radio')).toHaveCount(2)
    const vetoCard = hardMaps.getByRole('radio', { name: /Veto Hard maps/ })
    await expect(vetoCard).toContainText('Play 9 maps')
    await expect(vetoCard.getByRole('listitem')).toHaveText(HARD_MAPS)
    await expect(hardMaps.getByRole('radio', { name: /Play Hard maps/ })).toContainText('Play 13 maps')
    await expect(page.getByRole('button', { name: 'Lock In' })).toBeDisabled()
    await expect(page.getByText('Hard?').first()).toBeVisible()
    for (const map of HARD_MAPS) await expect(stage(page).getByTitle(map, { exact: true })).toHaveCount(1)

    await chooseCard(hardMaps, /Veto Hard maps/)
    await page.getByRole('button', { name: 'Lock In Veto' }).click()

    await expect.poll(() => server.posts.length).toBe(1)
    expect(server.posts[0]).toEqual({ path: `${STATE_PATH}/veto`, body: { choice: 'veto', version: 5 }, authorization: 'Bearer captain-token' })

    await expect(controls(page).getByText('T15 veto the Hard maps')).toBeVisible()
    await expect(controls(page).getByText('9 maps', { exact: true })).toBeVisible()
    await expect(steps(page).getByText('Excluded', { exact: true })).toBeVisible()
    await expect(steps(page).getByText('Vetoed · T15')).toHaveCount(HARD_MAPS.length)
    await expect(page.getByText('Hard?')).toHaveCount(0)

    setState(server, sideChoiceAfterVeto())

    const sides = page.getByRole('radiogroup', { name: 'Side' })
    await expect(sides.getByRole('radio')).toHaveCount(2)
    await expect(sides.getByLabel('Red steps').getByRole('listitem')).toHaveCount(4)
    await expect(sides.getByLabel('Blue steps').getByRole('listitem')).toHaveCount(4)
    const redNumbers = await sides.getByLabel('Red steps').getByRole('listitem').evaluateAll(items => items.map(item => item.textContent?.trim().split(' ')[0]))
    const blueNumbers = await sides.getByLabel('Blue steps').getByRole('listitem').evaluateAll(items => items.map(item => item.textContent?.trim().split(' ')[0]))
    expect(redNumbers).toEqual(['1', '4', '6', '8'])
    expect(blueNumbers).toEqual(['2', '3', '5', '7'])
    await expect(steps(page).getByText('Vetoed · T15')).toHaveCount(HARD_MAPS.length)
    for (const map of HARD_MAPS) await expect(stage(page).getByTitle(map, { exact: true })).toHaveCount(0)
    await expect(steps(page).getByRole('listitem').filter({ hasText: /Step \d+/ })).toHaveCount(9)

    await chooseCard(sides, /Red/)
    await page.getByRole('button', { name: 'Lock In Red' }).click()

    await expect.poll(() => server.posts.length).toBe(2)
    expect(server.posts[1]).toEqual({ path: `${STATE_PATH}/side`, body: { choice: 'red', version: 7 }, authorization: 'Bearer captain-token' })
    await expect(controls(page).getByText('Sides set')).toBeVisible()
})

test('a captain whose veto was beaten to it reads that the choice is already made', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const server = fakeServer(viewedBy(vetoChoiceOfLobby(['team_b']), 'team_b'), () => ({
        status: 409,
        json: pickBanVetoErrorFixture('errorAlreadyChosen'),
    }))
    await serve(page, server)
    await page.goto(PAGE_PATH)

    await chooseCard(page.getByRole('radiogroup', { name: 'Hard maps' }), /Play Hard maps/)
    await page.getByRole('button', { name: 'Lock In Play' }).click()

    await expect(page.getByRole('alert')).toContainText('Your team has already made its Hard-map choice.')
    await expect(page.getByRole('radiogroup', { name: 'Hard maps' })).toBeVisible()
})

test('a captain who is not eligible waits while the other team decides, then sees the outcome and waits for the side', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const waiting = viewedBy(vetoChoiceOfLobby(['team_b']), 'team_a')
    const server = fakeServer({ ...waiting, capabilities: { ...waiting.capabilities, can_veto: false } })
    await serve(page, server)
    await page.goto(PAGE_PATH)

    await expect(controls(page).getByText('T15 are deciding on the Hard maps')).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Hard maps' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Lock In/ })).toHaveCount(0)
    await expect(page.getByText('Hard?').first()).toBeVisible()

    const spotlight = viewedBy(vetoState('pickBanVetoSpotlightVetoed'), 'team_a')
    setState(server, spotlight)
    await expect(controls(page).getByText('T15 veto the Hard maps')).toBeVisible()
    await expect(steps(page).getByText('Vetoed · T15')).toHaveCount(HARD_MAPS.length)
    await expect(controls(page).getByText('T15 are deciding on the Hard maps')).toHaveCount(0)

    const choosing = viewedBy(sideChoiceAfterVeto(), 'team_a')
    setState(server, { ...choosing, capabilities: { ...choosing.capabilities, can_choose_side: false } })
    await expect(controls(page).getByText('T15 are choosing their side')).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Side' })).toHaveCount(0)
    expect(server.posts).toEqual([])
})

test('the last captain to choose plays, and both teams play on 13 maps with the A, B, B, A ban-down', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const choosing = vetoState('pickBanVetoChoice')
    const played = viewedBy(vetoState('pickBanVetoSpotlightPlayed'), 'team_b')
    const server = fakeServer(choosing, post => (post.path.endsWith('/veto') ? accepted(played, server) : null))
    await serve(page, server)
    await page.goto(PAGE_PATH)

    const hardMaps = page.getByRole('radiogroup', { name: 'Hard maps' })
    await expect(hardMaps.getByRole('radio', { name: /Play Hard maps/ })).toContainText('Play 13 maps')
    await expect(page.getByText('Hard?').first()).toBeVisible()
    await chooseCard(hardMaps, /Play Hard maps/)
    await page.getByRole('button', { name: 'Lock In Play' }).click()

    await expect.poll(() => server.posts.length).toBe(1)
    expect(server.posts[0].body).toEqual({ choice: 'play', version: 5 })

    await expect(controls(page).getByText('Hard maps stay in')).toBeVisible()
    await expect(controls(page).getByText('13 maps', { exact: true })).toBeVisible()
    await expect(steps(page).getByText('Excluded', { exact: true })).toHaveCount(0)
    await expect(steps(page).getByText(/^Vetoed/)).toHaveCount(0)
    await expect(page.getByText('Hard?')).toHaveCount(0)

    const slots = steps(page).getByRole('listitem').filter({ hasText: /Step \d+/ })
    await expect(slots).toHaveCount(13)
    const titles = await slots.evaluateAll(items => items.map(item => item.getAttribute('title') ?? ''))
    expect(titles.slice(0, 8).every(title => title.includes('sequence.'))).toBe(true)
    const banDown = titles.slice(8, 12)
    expect(banDown.every(title => title.startsWith('Step') && title.includes('bans.'))).toBe(true)
    expect(banDown.map(title => /\((Red|Blue)\) bans/.exec(title)?.[1])).toEqual(['Red', 'Blue', 'Blue', 'Red'])
    expect(titles[12]).toContain('decider.')
})

test('a captain who already played sees who the veto is waiting for', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const choosing = vetoState('pickBanVetoChoice')
    const waiting = viewedBy({ ...choosing, capabilities: { ...choosing.capabilities, can_veto: false } }, 'team_a')
    await serve(page, fakeServer(waiting))
    await page.goto(PAGE_PATH)

    await expect(controls(page).getByText('Waiting for T16')).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Hard maps' })).toHaveCount(0)
})

test('the manager sees the veto line in the lobby', async ({ page, isMobile }) => {
    test.skip(isMobile)

    await serve(page, fakeServer(managedBy(vetoState('pickBanLobbyVeto'))), 'manager')
    await page.goto(PAGE_PATH)

    const veto = page.getByRole('group', { name: 'Map Veto' })
    await expect(veto).toContainText('Hard-map veto: T15 eligible')
    await expect(veto.getByText(/Act for/)).toHaveCount(0)
    await expect(stage(page)).toContainText(/Waiting for an admin to start/)
})

test('the manager acts for an eligible team after confirming, and the dock shows the outcome and Undo Veto', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const choosing = managedBy(vetoState('pickBanVetoChoice'))
    const vetoed = managedBy(vetoState('pickBanVetoSpotlightVetoed'))
    const server = fakeServer(choosing, post => (post.path.endsWith('/veto') ? accepted(vetoed, server) : null))
    await serve(page, server, 'manager')
    await page.goto(PAGE_PATH)

    const veto = page.getByRole('group', { name: 'Map Veto' })
    const choices = veto.getByLabel('Veto choices')
    await expect(choices.getByRole('listitem').filter({ hasText: 'T12' })).toContainText('Play')
    await expect(choices.getByRole('listitem').filter({ hasText: 'T16' })).toContainText('Deciding')
    await expect(veto.getByRole('group', { name: /Act for/ })).toHaveCount(1)
    const actFor = veto.getByRole('group', { name: 'Act for T16' })
    await expect(actFor.getByRole('button')).toHaveText([/Veto Hard maps\s*Play 9 maps/, /Play Hard maps\s*Play 13 maps/])

    await actFor.getByRole('button', { name: /Veto Hard maps/ }).click()
    expect(server.posts).toEqual([])
    const confirmTitle = page.getByRole('heading', { name: 'Veto the Hard maps for T16?' })
    await expect(confirmTitle).toBeVisible()
    await page.getByRole('button', { name: 'Go Back' }).click()
    await expect(confirmTitle).toHaveCount(0)
    expect(server.posts).toEqual([])

    await actFor.getByRole('button', { name: /Veto Hard maps/ }).click()
    await page.getByRole('button', { name: 'Veto Hard Maps', exact: true }).click()

    await expect.poll(() => server.posts.length).toBe(1)
    expect(server.posts[0]).toEqual({
        path: `${ADMIN_STATE_PATH}/veto`,
        body: { side: 'team_b', choice: 'veto', version: 5 },
        authorization: 'Bearer captain-token',
    })
    await expect(veto.getByRole('status')).toContainText('vetoed the Hard maps · 9 maps')
    await expect(veto.getByRole('group', { name: /Act for/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Undo Veto' })).toBeEnabled()
})

test('at a phone width the veto cards and the side cards fit the screen', async ({ page, isMobile }) => {
    test.skip(!isMobile)
    await page.setViewportSize({ width: 360, height: 800 })

    const server = fakeServer(viewedBy(vetoChoiceOfLobby(['team_b']), 'team_b'))
    await serve(page, server)
    await page.goto(PAGE_PATH)

    const hardMaps = page.getByRole('radiogroup', { name: 'Hard maps' })
    await expect(hardMaps.getByRole('radio')).toHaveCount(2)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
    const cardRightEdges = await hardMaps.getByRole('radio').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().right))
    expect(Math.max(...cardRightEdges)).toBeLessThanOrEqual(360)

    setState(server, sideChoiceAfterVeto())
    const sides = page.getByRole('radiogroup', { name: 'Side' })
    await expect(sides.getByRole('radio')).toHaveCount(2)
    const sideRightEdges = await sides.getByRole('radio').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().right))
    expect(Math.max(...sideRightEdges)).toBeLessThanOrEqual(360)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
})
