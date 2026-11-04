import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const PLAYABLE_VIDEO = `data:video/webm;base64,${readFileSync(resolve(__dirname, '../../next-map-flythrough.webm')).toString('base64')}`

const REPLAY_PATH = /^\/replays\/[^/]+$/

function isRemoteVideo(value: unknown): value is string {
    return typeof value === 'string' && /^https?:\/\//.test(value)
}

export function withLocalReplayVideo(url: URL, json: unknown): unknown {
    if (!REPLAY_PATH.test(url.pathname) || typeof json !== 'object' || json === null) return json
    const video = json as { mp4_url?: unknown }
    return isRemoteVideo(video.mp4_url) ? { ...video, mp4_url: PLAYABLE_VIDEO } : json
}
