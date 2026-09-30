import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import type { StreamHotState, StreamMapScore, StreamMatchMap, StreamTeam } from '../app/components/stream/data/streamHotState'
import {
    idleHotState,
    streamHotState,
    streamMapScore,
    streamMaps,
    streamMatch,
    streamMember,
    streamScore,
    streamTeam,
    streamUserRef,
} from '../app/components/stream/data/streamFixtures'
import { BAND, SCORE_ROW } from '../app/components/stream/scenes/overlay/overlayLayout'
import { openScene, settleScene } from './streamHarness'

interface Box {
    x: number
    y: number
    width: number
    height: number
}

interface Painted {
    changedOutside: number
    paintedInZones: number
    composite: string
}

const CAMS = `data:image/jpeg;base64,${readFileSync(path.resolve(__dirname, 'overlay-quadrants.jpg')).toString('base64')}`
const CANVAS = { width: 1920, height: 1080 }
const CENTRE = { x: 960, y: 540 }
const TIMER_ZONES: Box[] = [
    [300, 0],
    [1260, 0],
    [300, 540],
    [1260, 540],
].map(([x, y]) => ({ x, y, width: 360, height: 96 }))
const SHADOW_PX = 40
const PARTS = ['tag-a1', 'tag-a2', 'tag-b1', 'tag-b2', 'hub']

const HAWKS = streamTeam('a', {
    name: 'Crimson Hawks',
    members: [streamMember('228152236587400001', 'Vexa', { captain: true }), streamMember('228152236587400002', 'Kodiak')],
})
const FROST = streamTeam('b', {
    name: 'Frostbite',
    members: [streamMember('228152236587400003', 'Mirelle', { captain: true }), streamMember('228152236587400004', 'xX_Skyhopper_Xx')],
})
const JUMP = streamTeam('b', { name: 'Jumpstart Syndicate', members: FROST.members })
const MAPS = streamMaps(['CTF-BT-Maverick', 'CTF-BT-(Ultimate)Mandarin', 'CTF-BT-Letss-Go', 'CTF-BT-Skyfall'], ['a', 'b', 'b', null])
const LONG_MAPS = streamMaps(['CTF-BT-II-Synchronize-vF2', 'CTF-BT-(Ultimate)Mandarin', 'CTF-BT-II-FuriumMineCE2', 'CTF-BT-Skyfall'], ['a', 'b', 'b', null])

function liveState(maps: StreamMapScore[], options: { teamB?: StreamTeam; mapList?: StreamMatchMap[] } = {}): StreamHotState {
    const teamB = options.teamB ?? FROST
    const decided = maps.every(map => map.decided) || maps.filter(map => map.winner === 'a').length >= 3
    const score = streamScore(maps, decided ? { current_map: null, winner: 'a', live_decided: true } : {})
    return streamHotState({
        reason: 'current',
        match: streamMatch({
            reason: 'current',
            status: 'in_progress',
            pick_ban_status: 'complete',
            teams: { a: HAWKS, b: teamB },
            lineup: {
                a1: streamUserRef(HAWKS.members[0]),
                a2: streamUserRef(HAWKS.members[1]),
                b1: streamUserRef(teamB.members[0]),
                b2: streamUserRef(teamB.members[1]),
            },
            maps: options.mapList ?? MAPS,
            score,
        }),
    })
}

const LIVE = liveState([streamMapScore(0, [2, 1], 'a'), streamMapScore(1, [1, 0]), streamMapScore(2), streamMapScore(3)])
const LONG = liveState([streamMapScore(0, [2, 0], 'a'), streamMapScore(1, [1, 2], 'b'), streamMapScore(2, [0, 1]), streamMapScore(3)], { teamB: JUMP, mapList: LONG_MAPS })

function grow(box: Box, by: number): Box {
    return { x: box.x - by, y: box.y - by, width: box.width + 2 * by, height: box.height + 2 * by }
}

function overlaps(a: Box, b: Box): boolean {
    return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function onEdgeOrCentre(box: Box): boolean {
    const touchesEdge = box.x <= 0 || box.y <= 0 || box.x + box.width >= CANVAS.width || box.y + box.height >= CANVAS.height
    const holdsCentre = box.x <= CENTRE.x && CENTRE.x <= box.x + box.width && box.y <= CENTRE.y && CENTRE.y <= box.y + box.height
    return touchesEdge || holdsCentre
}

async function overlayParts(page: Page): Promise<{ part: string; box: Box }[]> {
    return page.locator('[data-overlay-part]').evaluateAll(elements =>
        elements.map(element => {
            const rect = element.getBoundingClientRect()
            return { part: element.getAttribute('data-overlay-part') ?? '', box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
        }),
    )
}

async function paintOverCams(page: Page, keepOut: Box[]): Promise<Painted> {
    await settleScene(page)
    const overlay = await page.screenshot({ omitBackground: true })
    return page.evaluate(
        async ({ cams, shot, keepOut, zones }) => {
            const load = async (src: string) => {
                const image = new Image()
                image.src = src
                await image.decode()
                return image
            }
            const [camsImage, overlayImage] = await Promise.all([load(cams), load(`data:image/png;base64,${shot}`)])
            const canvas = document.createElement('canvas')
            canvas.width = camsImage.naturalWidth
            canvas.height = camsImage.naturalHeight
            const context = canvas.getContext('2d', { willReadFrequently: true })
            if (!context) throw new Error('no 2d context')
            const pixelsOf = () => context.getImageData(0, 0, canvas.width, canvas.height).data
            context.drawImage(overlayImage, 0, 0)
            const alpha = pixelsOf()
            context.clearRect(0, 0, canvas.width, canvas.height)
            context.drawImage(camsImage, 0, 0)
            const base = pixelsOf()
            context.drawImage(overlayImage, 0, 0)
            const composite = pixelsOf()
            const inside = (x: number, y: number, boxes: typeof zones) => boxes.some(box => x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height)
            let changedOutside = 0
            let paintedInZones = 0
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const index = (y * canvas.width + x) * 4
                    if (inside(x, y, zones) && alpha[index + 3] !== 0) paintedInZones++
                    if (inside(x, y, keepOut)) continue
                    if (composite[index] !== base[index] || composite[index + 1] !== base[index + 1] || composite[index + 2] !== base[index + 2]) changedOutside++
                }
            }
            return { changedOutside, paintedInZones, composite: canvas.toDataURL('image/png') }
        },
        { cams: CAMS, shot: overlay.toString('base64'), keepOut, zones: TIMER_ZONES },
    )
}

function pngOf(dataUrl: string): Buffer {
    return Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
}

async function expectClearOfTimers(page: Page): Promise<Painted> {
    await expect(page.locator('[data-overlay-part="hub"]')).toBeVisible()

    const parts = await overlayParts(page)
    expect(parts.map(entry => entry.part).sort()).toEqual([...PARTS].sort())
    for (const { part, box } of parts) {
        expect(onEdgeOrCentre(box), `${part} sits on an edge, a corner or the centre`).toBe(true)
        for (const zone of TIMER_ZONES) expect(overlaps(box, zone), `${part} clear of the timer zone at ${zone.x},${zone.y}`).toBe(false)
    }

    const painted = await paintOverCams(page, parts.map(entry => grow(entry.box, SHADOW_PX)))
    expect(painted.changedOutside).toBe(0)
    expect(painted.paintedInZones).toBe(0)
    return painted
}

async function boxOf(page: Page, selector: string): Promise<Box> {
    const box = await page.locator(selector).boundingBox()
    if (!box) throw new Error(`${selector} has no box`)
    return box
}

test('over the four cams the overlay shows the cams everywhere except its own elements, and keeps every timer zone clear', async ({ page }) => {
    await openScene(page, 'overlay', { hotState: LIVE })

    const painted = await expectClearOfTimers(page)
    expect(pngOf(painted.composite)).toMatchSnapshot('overlay-over-cams.png', { threshold: 0.2, maxDiffPixelRatio: 0.001 })
})

test('with long team and map names the band stays within its width and the timer zones stay clear', async ({ page }) => {
    await openScene(page, 'overlay', { hotState: LONG })

    await expectClearOfTimers(page)
    const strip = page.locator('[data-overlay-strip]')
    await expect(strip).toHaveAttribute('data-compact', 'true')
    expect((await boxOf(page, '[data-overlay-strip]')).width).toBeLessThanOrEqual(BAND.maxWidth)
    await expect(strip.locator('[data-overlay-map="1"]')).toHaveText('12–0')
    await expect(strip.locator('[data-overlay-map="2"]')).toHaveText('21–2')
    await expect(strip.locator('[data-overlay-map="3"]')).toContainText('II-FuriumMineCE2')
    await expect(strip.locator('[data-overlay-target]')).toBeVisible()
})

test('the score rows sit on either side of the seam, with the map strip centred on it', async ({ page }) => {
    await openScene(page, 'overlay', { hotState: LIVE })
    await settleScene(page)

    const top = await boxOf(page, '[data-overlay-team="a"]')
    const band = await boxOf(page, '[data-overlay-strip]')
    const bottom = await boxOf(page, '[data-overlay-team="b"]')

    expect([top.width, top.height, bottom.width, bottom.height]).toEqual([SCORE_ROW.width, SCORE_ROW.height, SCORE_ROW.width, SCORE_ROW.height])
    for (const box of [top, band, bottom]) expect(Math.abs(box.x + box.width / 2 - CENTRE.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(band.y + band.height / 2 - CENTRE.y)).toBeLessThanOrEqual(1)
    expect(top.y + top.height).toBeLessThanOrEqual(CENTRE.y)
    expect(bottom.y).toBeGreaterThanOrEqual(CENTRE.y)
})

test('the overlay shows the lineup, the pips, the current map caps, the map strip and the caps target', async ({ page }) => {
    await openScene(page, 'overlay', { hotState: LIVE })

    await expect(page.locator('[data-overlay-part="tag-a1"]')).toHaveText('Vexa')
    await expect(page.locator('[data-overlay-part="tag-a2"]')).toHaveText('Kodiak')
    await expect(page.locator('[data-overlay-part="tag-b1"]')).toHaveText('Mirelle')
    await expect(page.locator('[data-overlay-part="tag-b2"]')).toHaveText('xX_Skyhopper_Xx')
    await expect(page.locator('[data-overlay-part="tag-a1"] img')).toHaveAttribute('src', /\/users\/228152236587400001\/avatar/)
    await expect(page.locator('[data-overlay-part="tag-a1"] img')).toHaveClass(/rounded-full/)

    const [top, bottom] = await page.locator('[data-overlay-team]').all()
    await expect(top).toHaveAttribute('data-overlay-team', 'a')
    await expect(top).toContainText('Crimson Hawks')
    await expect(bottom).toContainText('Frostbite')
    await expect(top.getByRole('img', { name: '1 of 3 maps won' })).toBeVisible()
    await expect(bottom.getByRole('img', { name: '0 of 3 maps won' })).toBeVisible()
    await expect(page.locator('[data-overlay-caps="a"]')).toHaveText('1')
    await expect(page.locator('[data-overlay-caps="b"]')).toHaveText('0')

    const cells = page.locator('[data-overlay-map]')
    await expect(cells).toHaveCount(4)
    expect(await cells.evaluateAll(elements => elements.map(element => [element.getAttribute('data-map-state'), element.getAttribute('data-map-tone')]))).toEqual([
        ['played', 'a'],
        ['current', 'b'],
        ['upcoming', 'b'],
        ['upcoming', 'gold'],
    ])
    await expect(cells.nth(0).locator('[data-map-result]')).toHaveText('2–1')
    await expect(cells.nth(1)).toHaveText('2(Ultimate)Mandarin')
    await expect(cells.nth(3)).toHaveText('4Skyfall')
    await expect(page.locator('[data-overlay-target]')).toHaveText('FT2')

    const text = await page.locator('[data-stream-match]').innerText()
    expect(text).not.toMatch(/\b[AB][12]?\b/)
    expect(text).not.toContain('Group Stage')
    expect(text).not.toContain('Picked by')
})

test('a completed team run shows on the next hot-state read, within seconds', async ({ page }) => {
    const api = await openScene(page, 'overlay', { hotState: LIVE })
    await expect(page.locator('[data-overlay-caps="a"]')).toHaveText('1')

    api.setHotState(liveState([streamMapScore(0, [2, 1], 'a'), streamMapScore(1, [1, 1]), streamMapScore(2), streamMapScore(3)]))
    await expect(page.locator('[data-overlay-caps="b"]')).toHaveText('1', { timeout: 4_000 })

    api.setHotState(liveState([streamMapScore(0, [2, 1], 'a'), streamMapScore(1, [2, 1], 'a', { source: 'live' }), streamMapScore(2), streamMapScore(3)]))
    await expect(page.locator('[data-overlay-team="a"]').getByRole('img', { name: '2 of 3 maps won' })).toBeVisible({ timeout: 4_000 })
    await expect(page.locator('[data-overlay-map="2"]')).toHaveAttribute('data-map-state', 'played')
    await expect(page.locator('[data-overlay-map="2"] [data-map-result]')).toHaveText('2–1')
    await expect(page.locator('[data-overlay-map="3"]')).toHaveAttribute('data-map-state', 'current')
    await expect(page.locator('[data-overlay-caps="a"]')).toHaveText('0')
    await expect(page.locator('[data-overlay-part="hub"]')).toHaveAttribute('data-caps-source', 'live')
})

test('when nothing is resolved the overlay shows nothing, with no letterbox at any window size', async ({ page }) => {
    const api = await openScene(page, 'overlay', { hotState: LIVE })
    await expect(page.locator('[data-overlay-part="hub"]')).toBeVisible()

    api.setHotState(idleHotState())
    await expect(page.locator('[data-overlay-part]')).toHaveCount(0)
    await expect(page.locator('[data-stream-scene="overlay"]')).toBeVisible()
    expect((await paintOverCams(page, [])).changedOutside).toBe(0)

    await page.setViewportSize({ width: 1600, height: 1200 })
    const shot = await page.screenshot({ omitBackground: true })
    const opaque = await page.evaluate(async data => {
        const image = new Image()
        image.src = `data:image/png;base64,${data}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')
        if (!context) throw new Error('no 2d context')
        context.drawImage(image, 0, 0)
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        let count = 0
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 0) count++
        return count
    }, shot.toString('base64'))
    expect(opaque).toBe(0)
})

test('the overlay never plays a sound, whatever the URL options say', async ({ page }) => {
    await page.addInitScript(() => {
        const probe = window as unknown as { soundAttempts: string[] }
        probe.soundAttempts = []
        const NativeAudioContext = window.AudioContext
        window.AudioContext = class extends NativeAudioContext {
            constructor(options?: AudioContextOptions) {
                probe.soundAttempts.push('AudioContext')
                super(options)
            }
        }
        const play = HTMLMediaElement.prototype.play
        HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
            probe.soundAttempts.push('play')
            return play.call(this)
        }
    })
    const audioRequests: string[] = []
    page.on('request', request => {
        if (request.resourceType() === 'media' || /\.(mp3|ogg|wav|m4a)(\?|$)/.test(request.url())) audioRequests.push(request.url())
    })

    const api = await openScene(page, 'overlay', { hotState: LIVE, query: 'sound=1&volume=100&motion=1' })
    await expect(page.locator('[data-overlay-part="hub"]')).toBeVisible()
    await page.mouse.click(960, 300)
    await page.keyboard.press('Space')

    api.setHotState(liveState([streamMapScore(0, [2, 1], 'a'), streamMapScore(1, [2, 0], 'a'), streamMapScore(2, [2, 1], 'a', { source: 'live' }), streamMapScore(3)]))
    await expect(page.locator('[data-overlay-team="a"]').getByRole('img', { name: '3 of 3 maps won' })).toBeVisible({ timeout: 4_000 })
    await page.waitForTimeout(500)

    const attempts = () => page.evaluate(() => (window as unknown as { soundAttempts: string[] }).soundAttempts)
    expect(await attempts()).toEqual([])
    expect(audioRequests).toEqual([])

    await page.evaluate(() => new AudioContext().close())
    expect(await attempts()).toEqual(['AudioContext'])
})
