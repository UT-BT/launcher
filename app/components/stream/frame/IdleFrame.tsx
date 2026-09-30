import { cn } from '@/lib/utils'
import { BroadcastBackdrop } from '@/app/components/broadcast/BroadcastBackdrop'
import { BroadcastStage } from '@/app/components/broadcast/BroadcastStage'
import { ReconnectingBadge } from '@/app/components/broadcast/ReconnectingBadge'
import { useBroadcastFonts } from '@/app/components/broadcast/broadcastFonts'
import { BROADCAST_SURFACE } from '@/app/components/broadcast/broadcastTone'
import type { StreamSceneId } from '../streamScenes'
import { useStreamHotState } from '../data/useStreamData'
import { SceneLogo } from './SceneBranding'

export function IdleFrame({ scene }: { scene: StreamSceneId }) {
    useBroadcastFonts()
    const { state, reconnecting } = useStreamHotState()
    const eventName = state?.event.name ?? null

    return (
        <BroadcastStage>
            <div data-stream-scene={scene} data-scene-idle className={cn('relative h-full w-full overflow-hidden', BROADCAST_SURFACE)}>
                <BroadcastBackdrop left="a" right="b" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-[34px] px-16 text-center">
                    <SceneLogo className="size-[300px] object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)]" />
                    {eventName && (
                        <p className="max-w-full text-[104px] font-black italic uppercase leading-none [text-shadow:0_6px_30px_rgba(0,0,0,0.6)]">{eventName}</p>
                    )}
                    <p className="text-2xl font-bold uppercase tracking-[0.3em] text-white/55">utbt.net</p>
                </div>
                {reconnecting && <ReconnectingBadge />}
            </div>
        </BroadcastStage>
    )
}

export function BlankFrame({ scene, transparent = false }: { scene: StreamSceneId; transparent?: boolean }) {
    return (
        <BroadcastStage transparent={transparent}>
            <div data-stream-scene={scene} aria-busy className={cn('h-full w-full', !transparent && BROADCAST_SURFACE)} />
        </BroadcastStage>
    )
}
