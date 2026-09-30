import { useEffect, useState } from 'react'
import type { EventBracket, EventBracketStage, EventFormatSpec } from '@/app/utils/api'
import type { StreamSide } from '../../data/streamHotState'
import { streamMatchReadPath } from '../../data/streamHotState'
import { useSceneRead } from '../../data/useStreamData'
import { readConditional } from '../../data/conditionalRead'

export interface StandingsRead {
    server_now: string
    match_id: string
    group_id: string | null
    team_ids: Record<StreamSide, string | null>
    stage: EventBracketStage
}

export function standingsReadPath(eventSlug: string, matchId: string): string {
    return streamMatchReadPath(eventSlug, matchId, 'standings')
}

export function eventBracketPath(eventSlug: string): string {
    return `/tournaments/${encodeURIComponent(eventSlug)}/bracket`
}

export function useStandingsRead(eventSlug: string, matchId: string | null) {
    return useSceneRead<StandingsRead>(matchId === null ? null : standingsReadPath(eventSlug, matchId))
}

export function useStandingsFormat(eventSlug: string, wanted: boolean): EventFormatSpec | null {
    const [format, setFormat] = useState<{ slug: string; spec: EventFormatSpec | null } | null>(null)
    const loaded = format?.slug === eventSlug

    useEffect(() => {
        if (!wanted || loaded) return
        const controller = new AbortController()
        readConditional(eventBracketPath(eventSlug), { signal: controller.signal })
            .then(read => {
                if (read.kind !== 'fresh') return
                setFormat({ slug: eventSlug, spec: (read.data as EventBracket).format?.spec ?? null })
            })
            .catch(() => {
                if (!controller.signal.aborted) setFormat({ slug: eventSlug, spec: null })
            })
        return () => controller.abort()
    }, [eventSlug, wanted, loaded])

    return loaded ? format.spec : null
}
