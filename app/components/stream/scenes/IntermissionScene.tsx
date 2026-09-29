import { useMemo } from 'react'
import type { StreamSceneProps } from '../streamSceneOptions'
import type { StreamMatch } from '../data/streamHotState'
import { useSceneMatch, useSceneRead } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { SceneFrame } from '../frame/SceneFrame'
import type { StreamSound } from '@/app/components/pages/events/pickban/stream/streamSound'
import { intermissionReadPath, type IntermissionRead } from './intermission/intermissionRead'
import { intermissionView } from './intermission/intermissionView'
import { MapHeadline } from './intermission/MapHeadline'
import { NextMapCard } from './intermission/NextMapCard'
import { SeriesFinalCard } from './intermission/SeriesFinalCard'
import { SeriesTable } from './intermission/SeriesTable'
import { useMapReveal } from './intermission/useMapReveal'

function IntermissionBody({ eventSlug, match, sound }: { eventSlug: string; match: StreamMatch; sound: StreamSound }) {
    const current = match.score.current_map
    const read = useSceneRead<IntermissionRead>(current === null ? null : intermissionReadPath(eventSlug, match.id, current))
    const view = useMemo(() => intermissionView(match, read.data), [match, read.data])
    const reveal = useMapReveal(match, sound)

    return (
        <SceneFrame scene="intermission" title="Intermission" kicker={view.kicker}>
            <div className="grid h-full grid-cols-[1060px_1fr] gap-x-10">
                <div className="flex min-w-0 flex-col justify-center">
                    <MapHeadline match={match} latest={view.latest} reveal={reveal} />
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-[18px] shadow-2xl">
                        <SeriesTable maps={view.maps} series={view.series} teams={match.teams} reveal={reveal} />
                    </div>
                </div>
                {view.next && <NextMapCard match={match} next={view.next} />}
                {view.final && <SeriesFinalCard match={match} final={view.final} />}
            </div>
        </SceneFrame>
    )
}

export default function IntermissionScene({ eventSlug, options }: StreamSceneProps) {
    const { phase, match } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="intermission" />
    if (phase === 'idle') return <IdleFrame scene="intermission" />
    return <IntermissionBody key={match.id} eventSlug={eventSlug} match={match} sound={options.sound} />
}
