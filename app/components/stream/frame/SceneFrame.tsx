import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BroadcastBackdrop } from '@/app/components/broadcast/BroadcastBackdrop'
import { BroadcastStage } from '@/app/components/broadcast/BroadcastStage'
import { ReconnectingBadge } from '@/app/components/broadcast/ReconnectingBadge'
import { useBroadcastFonts } from '@/app/components/broadcast/broadcastFonts'
import { BROADCAST_SURFACE } from '@/app/components/broadcast/broadcastTone'
import type { StreamSceneId } from '../streamScenes'
import { SceneTicker } from '../SceneTicker'
import { stageLine } from '../sceneHelpers'
import { useSceneMatch, useStreamHotState } from '../data/useStreamData'
import { SceneBranding } from './SceneBranding'

interface SceneFrameProps {
    scene: StreamSceneId
    title: string
    kicker?: string | null
    subtitle?: string | null
    ticker?: boolean
    backdrop?: boolean
    children: ReactNode
}

export function SceneFrame({ scene, title, kicker = null, subtitle, ticker = true, backdrop = true, children }: SceneFrameProps) {
    useBroadcastFonts()
    const { reconnecting } = useStreamHotState()
    const { state, match } = useSceneMatch()
    const sub = subtitle === undefined ? (match ? stageLine(match) : null) : subtitle

    return (
        <BroadcastStage transparent={!backdrop}>
            <div data-stream-scene={scene} className={cn('relative h-full w-full overflow-hidden', BROADCAST_SURFACE, !backdrop && 'bg-transparent')}>
                {backdrop && <BroadcastBackdrop left="a" right="b" />}
                <header className="absolute inset-x-0 top-0 z-10 flex h-[152px] items-center justify-between gap-12 px-16">
                    <SceneBranding eventName={state?.event.name ?? null} subtitle={sub} />
                    <div className="flex shrink-0 flex-col items-end gap-2 text-right">
                        {kicker && <p className="text-lg font-bold uppercase tracking-[0.3em] text-white/55">{kicker}</p>}
                        <h1 className="text-[56px] font-black italic uppercase leading-none [text-shadow:0_6px_30px_rgba(0,0,0,0.6)]">{title}</h1>
                    </div>
                </header>
                <main className={cn('absolute inset-x-16 top-[168px] z-[2]', ticker ? 'bottom-[88px]' : 'bottom-12')}>{children}</main>
                {ticker && (
                    <div data-scene-ticker className="absolute inset-x-0 bottom-0 z-10 h-16">
                        <SceneTicker />
                    </div>
                )}
                {reconnecting && <ReconnectingBadge />}
            </div>
        </BroadcastStage>
    )
}

export function OverlayFrame({ scene, children }: { scene: StreamSceneId; children: ReactNode }) {
    useBroadcastFonts()
    const { reconnecting } = useStreamHotState()

    return (
        <BroadcastStage transparent>
            <div data-stream-scene={scene} className="relative h-full w-full overflow-hidden font-pickban text-white">
                {children}
                {reconnecting && <ReconnectingBadge />}
            </div>
        </BroadcastStage>
    )
}
