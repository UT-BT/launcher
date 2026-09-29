import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import type { StreamHotState } from '../app/components/stream/data/streamHotState'
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
const PARTS = ['tag-a1', 'tag-a2', 'tag-b1', 'tag-b2', 'hub', 'map']

const HOP = streamTeam('a', {
    name: 'Hop Theory',
    members: [streamMember('228152236587400001', 'Vexa', { captain: true }), streamMember('228152236587400002', 'Kodiak')],
})
const JUMP = streamTeam('b', {
    name: 'Jumpstart Syndicate',
    members: [streamMember('228152236587400003', 'Mirelle', { captain: true }), streamMember('228152236587400004', 'xX_Skyhopper_Xx')],
})
const MAPS = streamMaps(['CTF-BT-II-Diplopia-V4', 'CTF-BT-II-InventionCE2', 'CTF-BT-II-Fabricatorium', 'CTF-BT-II-FaithCB'], ['a', 'b', 'b', 'a'])

function liveState(fourth: [number, number], winner: 'a' | 'b' | null = null): StreamHotState {
    const played = [streamMapScore(1, [2, 0], 'a'), streamMapScore(2, [1, 2], 'b'), streamMapScore(3, [2, 1], 'a')]
    const current = winner ? streamMapScore(4, fourth, winner, { source: 'live' }) : streamMapScore(4, fourth)
    const score = streamScore([...played, current], winner ? { current_map: null, winner, live_decided: true } : {})
    return streamHotState({
        reason: 'current',
        match: streamMatch({
            reason: 'current',
            status: 'in_progress',
            pick_ban_status: 'complete',
            teams: { a: HOP, b: JUMP },
            lineup: {
                a1: streamUserRef(HOP.members[0]),
                a2: streamUserRef(HOP.members[1]),
                b1: streamUserRef(JUMP.members[0]),
                b2: streamUserRef(JUMP.members[1]),
            },
            maps: MAPS,
            score,
        }),
    })
}

const LIVE = liveState([1, 1])

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

test('over the four cams the overlay shows the cams everywhere except its own elements, and keeps every timer zone clear', async ({ page }) => {
    await openScene(page, 'overlay', { hotState: LIVE })
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
    expect(pngOf(painted.composite)).toMatchSnapshot('overlay-over-cams.png', { threshold: 0.2, maxDiffPixelRatio: 0.001 })
})

test('the overlay shows the lineup, the series flags, the current map caps, the map and the format', async ({ page }) => {
    await openScene(page, 'overlay', { hotState: LIVE })

    await expect(page.locator('[data-overlay-part="tag-a1"]')).toContainText('A1')
    await expect(page.locator('[data-overlay-part="tag-a1"]')).toContainText('Vexa')
    await expect(page.locator('[data-overlay-part="tag-a2"]')).toContainText('Kodiak')
    await expect(page.locator('[data-overlay-part="tag-b1"]')).toContainText('Mirelle')
    await expect(page.locator('[data-overlay-part="tag-b2"]')).toContainText('xX_Skyhopper_Xx')
    await expect(page.locator('[data-overlay-part="tag-a1"] img')).toHaveAttribute('src', /\/users\/228152236587400001\/avatar/)

    const [top, bottom] = await page.locator('[data-overlay-team]').all()
    await expect(top).toHaveAttribute('data-overlay-team', 'a')
    await expect(top).toContainText('Hop Theory')
    await expect(bottom).toContainText('Jumpstart Syndicate')
    await expect(top.getByRole('img', { name: '2 of 3 map wins' })).toBeVisible()
    await expect(bottom.getByRole('img', { name: '1 of 3 map wins' })).toBeVisible()
    await expect(page.locator('[data-overlay-caps="a"]')).toHaveText('1')
    await expect(page.locator('[data-overlay-caps="b"]')).toHaveText('1')

    const hub = page.locator('[data-overlay-part="hub"]')
    await expect(hub).toContainText('Map 4 of 4 · first to 2')
    const map = page.locator('[data-overlay-part="map"]')
    await expect(map).toContainText('II-FaithCB')
    await expect(map).toContainText('Picked by Hop Theory')
    await expect(map).toContainText('Group Stage · Group B · Round 4 · Bo4 · first to 2 team caps')
})

test('a completed team run shows on the next hot-state read, within seconds', async ({ page }) => {
    const api = await openScene(page, 'overlay', { hotState: LIVE })
    await expect(page.locator('[data-overlay-caps="a"]')).toHaveText('1')

    api.setHotState(liveState([1, 2]))
    await expect(page.locator('[data-overlay-caps="b"]')).toHaveText('2', { timeout: 4_000 })
    await expect(page.locator('[data-overlay-team="b"]').getByRole('img', { name: '1 of 3 map wins' })).toBeVisible()

    api.setHotState(liveState([2, 2]))
    await expect(page.locator('[data-overlay-caps="a"]')).toHaveText('2', { timeout: 4_000 })
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

    api.setHotState(liveState([2, 1], 'a'))
    await expect(page.locator('[data-overlay-team="a"]').getByRole('img', { name: '3 of 3 map wins' })).toBeVisible({ timeout: 4_000 })
    await page.waitForTimeout(500)

    const attempts = () => page.evaluate(() => (window as unknown as { soundAttempts: string[] }).soundAttempts)
    expect(await attempts()).toEqual([])
    expect(audioRequests).toEqual([])

    await page.evaluate(() => new AudioContext().close())
    expect(await attempts()).toEqual(['AudioContext'])
})
