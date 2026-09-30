import { useEffect, useState } from 'react'
import { fetchEvent } from '@/app/utils/api'
import type { MapThumbnailSize } from '@/app/utils/mapScreenshots'
import { BroadcastStage } from '@/app/components/broadcast/BroadcastStage'
import { ReconnectingBadge } from '@/app/components/broadcast/ReconnectingBadge'
import { usePickBanSession, usePickBanView } from '../usePickBanSession'
import { usePickBanPreload } from '../usePickBanPreload'
import { usePickBanSound } from '../usePickBanSound'
import { PickBanMotion } from '../components/PickBanMotion'
import { PickBanUnavailable } from '../components/PickBanUnavailable'
import { StreamBroadcast } from './StreamBroadcast'
import type { StreamSound } from './streamSound'

const BROADCAST_SIZES: MapThumbnailSize[] = ['card', 'hero']

interface StreamViewProps {
    eventSlug: string
    matchId: string
    sound: StreamSound
    animate: boolean
}

function useEventName(eventSlug: string): string | null {
    const [name, setName] = useState<string | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        fetchEvent('', eventSlug, controller.signal).then(
            event => setName(event.name),
            () => setName(null),
        )
        return () => controller.abort()
    }, [eventSlug])

    return name
}

export function StreamView({ eventSlug, matchId, sound, animate }: StreamViewProps) {
    const session = usePickBanSession({ accessToken: undefined, slug: eventSlug, matchId, alwaysPoll: true })
    const view = usePickBanView(session.state, session.clockOffsetMs)
    const eventName = useEventName(eventSlug)
    usePickBanPreload(view?.cards, BROADCAST_SIZES)
    usePickBanSound({ state: session.state, clockOffsetMs: session.clockOffsetMs, ...sound })

    return (
        <PickBanMotion animate={animate}>
            <BroadcastStage>
                <div className="flex h-full w-full flex-col overflow-hidden text-foreground">
                    {view ? (
                        <StreamBroadcast view={view} eventName={eventName} />
                    ) : session.loading ? (
                        <StreamSkeleton />
                    ) : (
                        <PickBanUnavailable error={session.error} className="h-full w-full" />
                    )}
                    {session.reconnecting && <ReconnectingBadge />}
                </div>
            </BroadcastStage>
        </PickBanMotion>
    )
}

function StreamSkeleton() {
    return (
        <div aria-busy className="flex h-full w-full items-center justify-center">
            <div className="h-64 w-64 animate-pulse rounded-xl bg-hairline/5" />
        </div>
    )
}
