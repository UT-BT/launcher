import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'

export const MEDIA_HOST = 'https://media.replays.test'
export const REPLAY_VIDEO_STRETCH = 16
export const REPLAY_VIDEO_SECONDS = 2 * REPLAY_VIDEO_STRETCH

const TIMECODE_SCALE = Buffer.from([0x2a, 0xd7, 0xb1, 0x83])

function stretched(video: Buffer, factor: number): Buffer {
    const copy = Buffer.from(video)
    const at = copy.indexOf(TIMECODE_SCALE) + TIMECODE_SCALE.length
    copy.writeUIntBE(copy.readUIntBE(at, 3) * factor, at, 3)
    return copy
}

export const REPLAY_VIDEO = stretched(readFileSync(resolve(__dirname, 'next-map-flythrough.webm')), REPLAY_VIDEO_STRETCH)

export function replayVideoUrl(capId: string, length?: number): string {
    return `${MEDIA_HOST}/${capId}.webm${length === undefined ? '' : `?length=${length}`}`
}

export async function serveReplayVideos(page: Page, missing: readonly string[] = []) {
    await page.addInitScript(() => {
        const native = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration')
        Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
            configurable: true,
            get(this: HTMLMediaElement) {
                const real = native?.get?.call(this) as number
                const length = Number(new URL(this.currentSrc || this.src, location.href).searchParams.get('length'))
                return Number.isFinite(real) && length > 0 ? length : real
            },
        })
    })
    await page.route(`${MEDIA_HOST}/**`, route => {
        const name = new URL(route.request().url()).pathname.slice(1).replace(/\.webm$/, '')
        if (missing.includes(name)) return route.fulfill({ status: 404, body: '' })
        const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '')
        const headers = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-type': 'video/webm' }
        if (!range) return route.fulfill({ status: 200, headers, body: REPLAY_VIDEO })
        const start = Number(range[1])
        const end = range[2] ? Math.min(Number(range[2]), REPLAY_VIDEO.length - 1) : REPLAY_VIDEO.length - 1
        return route.fulfill({
            status: 206,
            headers: { ...headers, 'content-range': `bytes ${start}-${end}/${REPLAY_VIDEO.length}` },
            body: REPLAY_VIDEO.subarray(start, end + 1),
        })
    })
}
