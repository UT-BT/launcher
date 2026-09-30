import { useEffect, useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@/app/styles/index.css'
import '../streamScenes.css'
import { BroadcastStage } from '@/app/components/broadcast/BroadcastStage'
import { BROADCAST_FONTS, useBroadcastFonts } from '@/app/components/broadcast/broadcastFonts'
import { Stinger } from './Stinger'
import { STINGER_DURATION_MS, STINGER_EVENT_NAME, STINGER_FPS, stingerFrameCount } from './stingerTimeline'

export interface StingerControl {
    ready: boolean
    frames: number
    fps: number
    durationMs: number
    seek: (ms: number) => Promise<void>
}

declare global {
    interface Window {
        stinger?: StingerControl
    }
}

const REPLAY_MS = STINGER_DURATION_MS + 800

const CHECKERBOARD = 'repeating-conic-gradient(#2a2a2a 0% 25%, #3a3a3a 0% 50%) 0 0 / 48px 48px'

const params = new URLSearchParams(window.location.search)

const rendering = params.get('render') === '1'

function seekNow(ms: number): void {
    for (const animation of document.getAnimations()) {
        animation.pause()
        animation.currentTime = ms
    }
}

function seek(ms: number): Promise<void> {
    seekNow(ms)
    return new Promise((painted) => requestAnimationFrame(() => requestAnimationFrame(() => painted())))
}

async function loadAssets(): Promise<void> {
    await Promise.all(BROADCAST_FONTS.map((font) => document.fonts.load(font)))
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)))
}

function StingerPage({ eventName }: { eventName: string }) {
    const [take, setTake] = useState(0)
    useBroadcastFonts()

    useLayoutEffect(() => {
        if (!rendering) return
        seekNow(0)
        const control: StingerControl = { ready: false, frames: stingerFrameCount(), fps: STINGER_FPS, durationMs: STINGER_DURATION_MS, seek }
        window.stinger = control
        void loadAssets().then(() => {
            control.ready = true
        })
    }, [])

    useEffect(() => {
        if (rendering) return
        const replay = window.setInterval(() => setTake((current) => current + 1), REPLAY_MS)
        return () => window.clearInterval(replay)
    }, [])

    return (
        <BroadcastStage transparent>
            <Stinger key={take} eventName={eventName} />
        </BroadcastStage>
    )
}

const container = document.getElementById('app') as HTMLElement
for (const element of [document.documentElement, document.body, container]) element.style.background = 'transparent'
if (params.get('checker') === '1') document.documentElement.style.background = CHECKERBOARD

createRoot(container).render(<StingerPage eventName={params.get('event')?.trim() || STINGER_EVENT_NAME} />)
