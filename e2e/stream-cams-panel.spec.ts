import path from 'node:path'
import { expect, test, type Page, type Route } from '@playwright/test'
import { horizontalOverflow } from './layout'

const HARNESS = `/@fs/${path.resolve(__dirname, 'camToolHarness.html').replace(/\\/g, '/').replace(/^\/+/, '')}`
const SLUG = 'cam-cup'
const STREAMER_ID = '555555555555555555'

test.describe.configure({ timeout: 60_000 })

const ALICE = { id: '111111111111111111', display_name: 'Alice', avatar: '' }
const ANNA = { id: '111111111111111112', display_name: 'Anna', avatar: '' }
const AXEL = { id: '111111111111111113', display_name: 'Axel', avatar: '' }
const BOB = { id: '222222222222222221', display_name: 'Bob', avatar: '' }
const BEA = { id: '222222222222222222', display_name: 'Bea', avatar: '' }

type Person = typeof ALICE
type Lineup = { a1: Person | null; a2: Person | null; b1: Person | null; b2: Person | null }

const FULL_LINEUP: Lineup = { a1: ALICE, a2: ANNA, b1: BOB, b2: BEA }

function member(person: Person, captain = false) {
    return { ...person, title: null, captain }
}

const CRIMSON = { id: 'ta', name: 'Crimson Tide', stage_seed: 1, pre_cup_seed: 1, members: [member(ALICE, true), member(ANNA), member(AXEL)] }
const AZURE = { id: 'tb', name: 'Azure Wave', stage_seed: 2, pre_cup_seed: 2, members: [member(BOB, true), member(BEA)] }

interface SidesState {
    flipped: boolean
    confirmed: boolean
    controls: { can_swap: boolean; blocked_reason: 'pick_ban_in_progress' | null }
    refusal: { status: number; code: string; error: string } | null
    puts: unknown[]
}

function sidesState(patch: Partial<SidesState> = {}): SidesState {
    return { flipped: false, confirmed: true, controls: { can_swap: false, blocked_reason: null }, refusal: null, puts: [], ...patch }
}

function deskMatchSides(sides: SidesState, lineup: Lineup) {
    if (!sides.flipped) {
        return {
            sides: { a: 'a', b: 'b' },
            teams: { a: { ...CRIMSON, match_side: 'a' }, b: { ...AZURE, match_side: 'b' } },
            lineup,
        }
    }
    return {
        sides: { a: 'b', b: 'a' },
        teams: { a: { ...AZURE, match_side: 'b' }, b: { ...CRIMSON, match_side: 'a' } },
        lineup: { a1: lineup.b1, a2: lineup.b2, b1: lineup.a1, b2: lineup.a2 },
    }
}

function deskPayload(lineup: Lineup, sides: SidesState) {
    return {
        server_now: new Date().toISOString().replace('Z', '+00:00'),
        event: { name: 'Cam Cup', slug: SLUG },
        streamer: { id: STREAMER_ID, display_name: 'Streamer', channel: null },
        desk: { brb_message: null, webcam_enabled: false, current_match_id: 'm1' },
        reason: 'current',
        match: {
            id: 'm1',
            reason: 'current',
            stage: { key: 'groups', name: 'Groups' },
            group: null,
            round: { no: 1, label: null },
            best_of: 3,
            mode: 'ctf',
            caps_to_win: 2,
            scheduled_at: null,
            countdown_at: null,
            live_at: null,
            status: 'live',
            stream_url: null,
            pick_ban_status: 'complete',
            ...deskMatchSides(sides, lineup),
            side_status: { confirmed: sides.confirmed, source: sides.confirmed ? 'caster' : null },
            side_controls: sides.controls,
            maps: [],
            score: { maps: [], current_map: null, series: { a: 0, b: 0 }, winner: null, live_decided: false },
            casters: [],
        },
        assigned_matches: [],
        next_match: null,
    }
}

function gameServer(id: string, ip: string, hostport: number, hostname: string, players: Person[], certified = true) {
    return {
        id,
        ip,
        hostport,
        hostname,
        map_name: 'CTF-BT-Example',
        player_count: players.length,
        max_players: 16,
        spectators: 0,
        certified_records: certified,
        players: players.map(player => ({ id: player.id, name: player.display_name, ping: 40, time: 60, team: 0, deaths: 0, is_spectator: false })),
    }
}

const SHARED = gameServer('s1', '203.0.113.10', 7777, 'UTBT Cup #1', [ALICE, ANNA, BOB, BEA])
const EMPTY = gameServer('s2', '203.0.113.20', 7788, 'UTBT Cup #2', [])
const SPLIT_A = gameServer('s1', '203.0.113.10', 7777, 'UTBT Cup #1', [ALICE, ANNA])
const SPLIT_B = gameServer('s2', '203.0.113.20', 7788, 'UTBT Cup #2', [BOB, BEA])
const UNCERTIFIED_A = gameServer('s1', '203.0.113.10', 7777, 'Private Cup #1', [ALICE, ANNA], false)
const UNCERTIFIED_B = gameServer('s2', '203.0.113.20', 7788, 'Private Cup #2', [BOB, BEA], false)
const UNCERTIFIED_EMPTY = gameServer('s3', '203.0.113.30', 7799, 'Private Cup #3', [], false)
const UNCERTIFIED_WARNING = "Uncertified server: caps here won't count for the live score or records."

interface MockState {
    lineup: Lineup
    servers: unknown[]
    sides?: SidesState
}

async function answerSidesPut(route: Route, sides: SidesState) {
    sides.puts.push(route.request().postDataJSON())
    if (sides.refusal) {
        await route.fulfill({ status: sides.refusal.status, json: { success: false, error: sides.refusal.error, code: sides.refusal.code } })
        return
    }
    sides.flipped = !sides.flipped
    sides.confirmed = true
    const red = sides.flipped ? AZURE : CRIMSON
    const blue = sides.flipped ? CRIMSON : AZURE
    await route.fulfill({ json: { success: true, data: { red_team_id: red.id, blue_team_id: blue.id, a_match_side: sides.flipped ? 'b' : 'a', confirmed: true, source: 'caster' } } })
}

async function openHarness(page: Page, state: MockState, query = '') {
    const sides = state.sides ?? sidesState()
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: url.pathname === '/server-info' ? state.servers : [] })
            return
        }
        if (url.pathname === `/tournaments/${SLUG}/stream/${STREAMER_ID}/desk`) {
            await route.fulfill({ json: { success: true, data: deskPayload(state.lineup, sides) } })
            return
        }
        if (url.pathname === `/tournaments/${SLUG}/stream/matches/m1/sides` && route.request().method() === 'PUT') {
            await answerSidesPut(route, sides)
            return
        }
        await route.fulfill({ json: { success: true, data: [] } })
    })
    await page.goto(`${HARNESS}${query}`)
    await expect(page.getByRole('region', { name: 'Cams' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Red and Blue' })).toBeVisible()
}

function calls(page: Page, channel: string) {
    return page.evaluate(name => (window as unknown as { camHarness: { calls: { channel: string; args: unknown[] }[] } }).camHarness.calls
        .filter(call => call.channel === name)
        .map(call => call.args), channel)
}

function titledWindows(page: Page) {
    return page.evaluate(() => (window as unknown as { camHarness: { windows: () => string[] } }).camHarness.windows())
}

function cam(page: Page, slot: string) {
    return page.getByTestId(`cam-${slot}`)
}

const launchButton = (page: Page) => page.getByRole('button', { name: /Launch cams|Relaunch cams/ })

test('four cams launch for the live lineup on one shared server and each window is titled', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED, EMPTY] })

    await expect(page.getByTestId('cam-team-A-address')).toHaveText('203.0.113.10:7777')
    await expect(page.getByTestId('cam-team-B-address')).toHaveText('203.0.113.10:7777')
    await expect(page.getByTestId('cam-layout')).toContainText('one server')
    await expect(page.getByTestId('cam-team-A')).toContainText('2 of 3 Crimson Tide players found on UTBT Cup #1.')

    await launchButton(page).click()

    const expected = {
        lineup: { A1: ALICE.id, A2: ANNA.id, B1: BOB.id, B2: BEA.id },
        servers: { A: '203.0.113.10:7777', B: '203.0.113.10:7777' },
        passwords: { A: null, B: null },
        fps: 120,
        volume: 50,
    }
    await expect.poll(() => calls(page, 'launchCams')).toEqual([[expected]])
    expect(await calls(page, 'planCams')).toEqual([[expected]])

    for (const slot of ['A1', 'A2', 'B1', 'B2']) {
        await expect(cam(page, slot).getByText('Running')).toBeVisible()
        await expect(cam(page, slot).getByText('Titled', { exact: true })).toBeVisible({ timeout: 5_000 })
        await expect(page.getByTestId(`cam-${slot}-server`)).toContainText('203.0.113.10:7777')
    }
    expect(await titledWindows(page)).toEqual(['UTBT Cam A1', 'UTBT Cam A2', 'UTBT Cam B1', 'UTBT Cam B2'])
    await expect(page.getByTestId('cam-A1-target')).toContainText('Alice')
    await expect(page.getByTestId('cam-B2-target')).toContainText('Bea')
    await expect(launchButton(page)).toHaveText('Relaunch cams')
})

test('the cams run at 120 fps unless the streamer picks 60, and the choice reaches the launch request', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED] })

    const fps = page.getByRole('group', { name: 'Cam FPS' })
    await expect(fps.getByRole('button', { name: '120' })).toHaveAttribute('aria-pressed', 'true')
    await expect(fps.getByRole('button', { name: '60' })).toHaveAttribute('aria-pressed', 'false')

    await fps.getByRole('button', { name: '60' }).click()

    await expect(fps.getByRole('button', { name: '60' })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => calls(page, 'setCamFps')).toEqual([[60]])

    await launchButton(page).click()

    await expect.poll(() => calls(page, 'launchCams')).toEqual([[{
        lineup: { A1: ALICE.id, A2: ANNA.id, B1: BOB.id, B2: BEA.id },
        servers: { A: '203.0.113.10:7777', B: '203.0.113.10:7777' },
        passwords: { A: null, B: null },
        fps: 60,
        volume: 50,
    }]])
    await cam(page, 'B1').getByRole('button', { name: 'Restart B1' }).click()
    await expect.poll(async () => (await calls(page, 'restartCam')).map(([slot, request]) => [slot, (request as { fps: number }).fps])).toEqual([['B1', 60]])
})

test('the cam volume slider saves on release and reaches the launch request', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED] })

    const volume = page.getByLabel('Cam volume')
    await expect(volume).toHaveValue('50')
    await volume.focus()
    for (let step = 0; step < 4; step += 1) await page.keyboard.press('ArrowLeft')

    await expect(volume).toHaveValue('30')
    await expect.poll(async () => (await calls(page, 'setCamVolume')).at(-1)).toEqual([30])
    await launchButton(page).click()

    await expect.poll(async () => (await calls(page, 'launchCams')).map(([request]) => (request as { volume: number }).volume)).toEqual([30])
})

test('the cam tool opens on the saved volume', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED] }, '?volume=15')

    await expect(page.getByLabel('Cam volume')).toHaveValue('15')
    await launchButton(page).click()

    await expect.poll(async () => (await calls(page, 'launchCams')).map(([request]) => (request as { volume: number }).volume)).toEqual([15])
    expect(await calls(page, 'setCamVolume')).toEqual([])
})

test('the cam tool opens on the saved frame rate', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED] }, '?fps=60')

    const fps = page.getByRole('group', { name: 'Cam FPS' })
    await expect(fps.getByRole('button', { name: '60' })).toHaveAttribute('aria-pressed', 'true')
    await launchButton(page).click()

    await expect.poll(async () => (await calls(page, 'launchCams')).map(([request]) => (request as { fps: number }).fps)).toEqual([60])
    expect(await calls(page, 'setCamFps')).toEqual([])
})

test('each team goes to its own server when they play on two', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SPLIT_A, SPLIT_B] })

    await expect(page.getByTestId('cam-layout')).toContainText('two servers')
    await launchButton(page).click()

    await expect.poll(() => calls(page, 'launchCams')).toEqual([[{
        lineup: { A1: ALICE.id, A2: ANNA.id, B1: BOB.id, B2: BEA.id },
        servers: { A: '203.0.113.10:7777', B: '203.0.113.20:7788' },
        passwords: { A: null, B: null },
        fps: 120,
        volume: 50,
    }]])
    await expect(page.getByTestId('cam-B1-server')).toContainText('203.0.113.20:7788')
})

test('a picked or typed server overrides detection', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SPLIT_A, SPLIT_B] })

    await page.getByTestId('cam-team-B').getByLabel('Server', { exact: true }).selectOption({ label: 'UTBT Cup #1 · 2 playing' })
    await expect(page.getByTestId('cam-team-B-address')).toHaveText('203.0.113.10:7777')
    await expect(page.getByTestId('cam-layout')).toContainText('one server')

    await page.getByTestId('cam-team-A').getByLabel('Server', { exact: true }).selectOption({ label: 'Type an address…' })
    const typed = page.getByLabel('Crimson Tide server address')
    await typed.fill('not a server')
    await expect(page.getByText("The address typed for Crimson Tide can't be joined.", { exact: false })).toBeVisible()
    await expect(launchButton(page)).toBeDisabled()

    await typed.fill('unreal://bt.example.net:7790')
    await expect(page.getByTestId('cam-team-A-address')).toHaveText('bt.example.net:7790')
    await launchButton(page).click()

    await expect.poll(() => calls(page, 'launchCams')).toEqual([[{
        lineup: { A1: ALICE.id, A2: ANNA.id, B1: BOB.id, B2: BEA.id },
        servers: { A: 'bt.example.net:7790', B: '203.0.113.10:7777' },
        passwords: { A: null, B: null },
        fps: 120,
        volume: 50,
    }]])
})

test('a server password typed once joins both teams on a shared server without a prompt', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED] })

    const passwordA = page.getByTestId('cam-team-A').getByLabel('Server password')
    const passwordB = page.getByTestId('cam-team-B').getByLabel('Server password')
    await expect(passwordA).toHaveAttribute('type', 'password')

    await passwordA.fill('two words')
    await expect(page.getByText("The password typed for Crimson Tide can't be sent to the game.", { exact: false })).toBeVisible()
    await expect(launchButton(page)).toBeDisabled()

    await passwordA.fill('cup2026')
    await expect(passwordB).toHaveAttribute('placeholder', 'Same as Team A')
    await launchButton(page).click()

    await expect.poll(() => calls(page, 'launchCams')).toEqual([[{
        lineup: { A1: ALICE.id, A2: ANNA.id, B1: BOB.id, B2: BEA.id },
        servers: { A: '203.0.113.10:7777', B: '203.0.113.10:7777' },
        passwords: { A: 'cup2026', B: 'cup2026' },
        fps: 120,
        volume: 50,
    }]])
})

test('each team keeps its own server password on two servers', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SPLIT_A, SPLIT_B] })

    await page.getByTestId('cam-team-B').getByLabel('Server password').fill('azure')
    await expect(page.getByTestId('cam-team-A').getByLabel('Server password')).toHaveAttribute('placeholder', 'Only for a locked server')
    await launchButton(page).click()

    await expect.poll(async () => (await calls(page, 'launchCams')).map(([request]) => (request as { passwords: unknown }).passwords)).toEqual([{ A: null, B: 'azure' }])
})

test('a team on an uncertified server is warned, and a certified team is not', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SPLIT_A, UNCERTIFIED_B] })

    await expect(page.getByTestId('cam-team-B-uncertified')).toHaveText(UNCERTIFIED_WARNING)
    await expect(page.getByTestId('cam-team-A-uncertified')).toHaveCount(0)
})

test('picking an uncertified server from the list warns for that team only', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED, UNCERTIFIED_EMPTY] })
    await expect(page.getByTestId('cam-team-A-uncertified')).toHaveCount(0)
    await expect(page.getByTestId('cam-team-B-uncertified')).toHaveCount(0)

    await page.getByTestId('cam-team-A').getByLabel('Server', { exact: true }).selectOption({ label: 'Private Cup #3 · 0 playing' })

    await expect(page.getByTestId('cam-team-A-uncertified')).toHaveText(UNCERTIFIED_WARNING)
    await expect(page.getByTestId('cam-team-B-uncertified')).toHaveCount(0)
})

test('a lineup change flags the right cam and restarting it clears the flag', async ({ page }) => {
    const state: MockState = { lineup: FULL_LINEUP, servers: [SHARED] }
    await openHarness(page, state)
    await launchButton(page).click()
    await expect(page.getByTestId('cam-A2-target')).toContainText('Anna')

    state.lineup = { ...FULL_LINEUP, a2: AXEL }

    await expect(cam(page, 'A2').getByText("Restart cam A2: it follows a different player from the lineup's A2.")).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('cam-stale-summary')).toHaveText('The lineup changed. Restart A2 to follow the new player.')
    for (const slot of ['A1', 'B1', 'B2']) await expect(cam(page, slot).getByText('Wrong player')).toHaveCount(0)

    await cam(page, 'A2').getByRole('button', { name: 'Restart A2' }).click()

    await expect.poll(() => calls(page, 'restartCam')).toEqual([['A2', {
        lineup: { A1: ALICE.id, A2: AXEL.id, B1: BOB.id, B2: BEA.id },
        servers: { A: '203.0.113.10:7777', B: '203.0.113.10:7777' },
        passwords: { A: null, B: null },
        fps: 120,
        volume: 50,
    }]])
    await expect(page.getByTestId('cam-A2-target')).toContainText('Axel')
    await expect(page.getByTestId('cam-stale-summary')).toHaveCount(0)
    await expect(cam(page, 'A2').getByText('Wrong player')).toHaveCount(0)
})

test('a cam that followed its player to another server shows the new server', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED, EMPTY] })
    await launchButton(page).click()
    await expect(page.getByTestId('cam-B1-server')).toContainText('203.0.113.10:7777')

    await page.evaluate(() => (window as unknown as { camHarness: { moveCam: (slot: string, server: string) => void } }).camHarness.moveCam('B1', '203.0.113.20:7788'))

    await expect(page.getByTestId('cam-B1-server')).toContainText('203.0.113.20:7788 · UTBT Cup #2 (followed its player here)', { timeout: 5_000 })
})

test('stop all ends every cam', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED] })
    const stop = page.getByRole('button', { name: 'Stop all' })
    await expect(stop).toBeDisabled()

    await launchButton(page).click()
    await expect(cam(page, 'B2').getByText('Running')).toBeVisible()
    await stop.click()

    await expect.poll(() => calls(page, 'stopCams')).toHaveLength(1)
    for (const slot of ['A1', 'A2', 'B1', 'B2']) await expect(cam(page, slot).getByText('Stopped')).toBeVisible()
    expect(await titledWindows(page)).toEqual([])
    await expect(stop).toBeDisabled()
    await expect(launchButton(page)).toHaveText('Launch cams')
})

test('a missing Discord id blocks launch with a message', async ({ page }) => {
    await openHarness(page, { lineup: { ...FULL_LINEUP, b2: { id: '4242', display_name: 'Unlinked', avatar: '' } }, servers: [SHARED] })

    await expect(page.getByRole('list', { name: "Why the cams can't launch" })).toContainText('B2 has no player with a linked Discord account')
    await expect(cam(page, 'B2')).toContainText('No linked Discord account')
    await expect(launchButton(page)).toBeDisabled()
})

test('without the install path the panel points to the settings', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED] }, '?install=0')

    const blockers = page.getByRole('list', { name: "Why the cams can't launch" })
    await expect(blockers).toContainText('Settings > Game Installation')
    await expect(launchButton(page)).toBeDisabled()

    const opened = page.evaluate(() => new Promise(resolve => {
        window.addEventListener('open-settings', event => resolve((event as CustomEvent).detail), { once: true })
    }))
    await blockers.getByRole('button', { name: 'Open settings' }).click()
    expect(await opened).toEqual({ section: 'game-installation' })
})

function sidesCard(page: Page) {
    return page.getByRole('region', { name: 'Red and Blue' })
}

const swapButton = (page: Page) => sidesCard(page).getByRole('button', { name: 'Swap Red/Blue' })

test('the caster swaps Red and Blue after confirming a dialog that names both teams', async ({ page }) => {
    const sides = sidesState({ controls: { can_swap: true, blocked_reason: null } })
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED], sides })

    await expect(page.getByTestId('cam-sides-red')).toContainText('Crimson Tide')
    await expect(page.getByTestId('cam-sides-blue')).toContainText('Azure Wave')
    await expect(page.getByTestId('cam-sides-swapped')).toHaveCount(0)

    await swapButton(page).click()
    await expect(page.getByRole('heading', { name: 'Swap Red and Blue?' })).toBeVisible()
    await expect(page.getByText('Crimson Tide becomes Blue, Azure Wave becomes Red. Everything on stream follows.')).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    expect(sides.puts).toEqual([])

    await swapButton(page).click()
    await page.getByRole('button', { name: 'Swap sides' }).click()

    await expect.poll(() => sides.puts).toEqual([{ red_team_id: AZURE.id }])
    await expect(page.getByRole('heading', { name: 'Swap Red and Blue?' })).toHaveCount(0)
    await expect(page.getByTestId('cam-sides-red')).toContainText('Azure Wave')
    await expect(page.getByTestId('cam-sides-blue')).toContainText('Crimson Tide')
    await expect(page.getByTestId('cam-sides-swapped')).toHaveText('Sides swapped. Azure Wave is now Red, Crimson Tide is now Blue.')
    await expect(page.getByTestId('cam-team-A')).toContainText('Azure Wave')

    await page.getByRole('button', { name: 'Dismiss the sides swapped notice' }).click()
    await expect(page.getByTestId('cam-sides-swapped')).toHaveCount(0)
})

test('the swap is disabled with the reason while pick/ban runs', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED], sides: sidesState({ controls: { can_swap: true, blocked_reason: 'pick_ban_in_progress' } }) })

    await expect(swapButton(page)).toBeDisabled()
    await expect(sidesCard(page).getByText('Finish pick/ban first, or ask an admin.')).toBeVisible()
    await expect(swapButton(page)).toHaveAccessibleDescription('Finish pick/ban first, or ask an admin.')
})

test('the swap is hidden from a caster who may not swap', async ({ page }) => {
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED], sides: sidesState({ controls: { can_swap: false, blocked_reason: null } }) })

    await expect(page.getByTestId('cam-sides-red')).toContainText('Crimson Tide')
    await expect(swapButton(page)).toHaveCount(0)
})

test('a refused swap explains why', async ({ page }) => {
    const sides = sidesState({
        controls: { can_swap: true, blocked_reason: null },
        refusal: { status: 409, code: 'pick_ban_in_progress', error: 'Picks & Bans is in progress for this match.' },
    })
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED], sides })

    await swapButton(page).click()
    await page.getByRole('button', { name: 'Swap sides' }).click()

    await expect(sidesCard(page).getByRole('alert')).toHaveText('Finish pick/ban first, or ask an admin.')
    await expect(page.getByTestId('cam-sides-red')).toContainText('Crimson Tide')
    await expect(page.getByTestId('cam-sides-swapped')).toHaveCount(0)
})

test('the panel says Sides TBC until the side is confirmed', async ({ page }) => {
    const sides = sidesState({ confirmed: false })
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SHARED], sides })

    await expect(page.getByTestId('cam-sides-tbc')).toContainText('Sides TBC')

    sides.confirmed = true

    await expect(page.getByTestId('cam-sides-tbc')).toHaveCount(0, { timeout: 5_000 })
    await expect(page.getByTestId('cam-sides-swapped')).toHaveCount(0)
})

test('a swap made elsewhere shows Sides swapped, and a server picked for a team stays with that team', async ({ page }) => {
    const sides = sidesState()
    await openHarness(page, { lineup: FULL_LINEUP, servers: [SPLIT_A, SPLIT_B], sides })

    await page.getByTestId('cam-team-A').getByLabel('Server', { exact: true }).selectOption({ label: 'UTBT Cup #2 · 2 playing' })
    await page.getByTestId('cam-team-A').getByLabel('Server password').fill('crimson')
    await expect(page.getByTestId('cam-team-A-address')).toHaveText('203.0.113.20:7788')

    sides.flipped = true

    await expect(page.getByTestId('cam-sides-swapped')).toHaveText('Sides swapped. Azure Wave is now Red, Crimson Tide is now Blue.', { timeout: 5_000 })
    await expect(page.getByTestId('cam-team-B')).toContainText('Crimson Tide')
    await expect(page.getByTestId('cam-team-B-address')).toHaveText('203.0.113.20:7788')
    await expect(page.getByTestId('cam-team-B').getByLabel('Server password')).toHaveValue('crimson')
    await expect(page.getByTestId('cam-team-A').getByLabel('Server password')).toHaveValue('')

    await launchButton(page).click()

    await expect.poll(() => calls(page, 'launchCams')).toEqual([[{
        lineup: { A1: BOB.id, A2: BEA.id, B1: ALICE.id, B2: ANNA.id },
        servers: { A: '203.0.113.20:7788', B: '203.0.113.20:7788' },
        passwords: { A: 'crimson', B: 'crimson' },
        fps: 120,
        volume: 50,
    }]])
})

test('on the website the swap sits above the desktop-only cam notice', async ({ page }) => {
    const sides = sidesState({ confirmed: false, controls: { can_swap: true, blocked_reason: null } })
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        if (url.pathname === `/tournaments/${SLUG}/stream/${STREAMER_ID}/desk`) {
            await route.fulfill({ json: { success: true, data: deskPayload(FULL_LINEUP, sides) } })
            return
        }
        if (url.pathname === `/tournaments/${SLUG}/stream/matches/m1/sides` && route.request().method() === 'PUT') {
            await answerSidesPut(route, sides)
            return
        }
        await route.fulfill({ json: { success: true, data: [] } })
    })
    await page.goto(`${HARNESS}?panel=web`)

    const cams = page.getByRole('region', { name: 'Cams' })
    await expect(cams.getByText('The cam tool needs the desktop launcher.')).toBeVisible()
    await expect(page.getByTestId('cam-sides-tbc')).toBeVisible()
    const swapBox = await swapButton(page).boundingBox()
    const camsBox = await cams.boundingBox()
    expect(swapBox?.y ?? Infinity).toBeLessThan(camsBox?.y ?? 0)

    await swapButton(page).click()
    await page.getByRole('button', { name: 'Swap sides' }).click()

    await expect.poll(() => sides.puts).toEqual([{ red_team_id: AZURE.id }])
    await expect(page.getByTestId('cam-sides-swapped')).toBeVisible()
    await expect(page.getByTestId('cam-sides-tbc')).toHaveCount(0)
})

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
    test(`the cam tool fits at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport)
        const state: MockState = {
            lineup: FULL_LINEUP,
            servers: [UNCERTIFIED_A, UNCERTIFIED_B],
            sides: sidesState({ confirmed: false, controls: { can_swap: true, blocked_reason: 'pick_ban_in_progress' } }),
        }
        await openHarness(page, state)
        await expect(page.getByTestId('cam-team-A-uncertified')).toBeVisible()
        await expect(page.getByTestId('cam-team-B-uncertified')).toBeVisible()
        await launchButton(page).click()
        await expect(cam(page, 'B2').getByText('Titled', { exact: true })).toBeVisible({ timeout: 5_000 })
        state.lineup = { ...FULL_LINEUP, a2: AXEL }
        await expect(page.getByTestId('cam-stale-summary')).toBeVisible({ timeout: 5_000 })

        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        await expect(page.getByTestId('cam-sides-tbc')).toBeVisible()
        for (const name of ['Swap Red/Blue', 'Relaunch cams', 'Stop all', 'Restart A2', '60', '120']) {
            const box = await page.getByRole('button', { name }).boundingBox()
            expect(box?.height ?? 0).toBeGreaterThanOrEqual(28)
            expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
            expect((box?.x ?? 0) + (box?.width ?? Infinity)).toBeLessThanOrEqual(viewport.width)
        }
    })
}
