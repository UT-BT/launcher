import { useMemo } from 'react'
import type { StreamSceneProps } from '../streamSceneOptions'
import type { StreamMatch } from '../data/streamHotState'
import { useSceneMatch } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { SceneFrame } from '../frame/SceneFrame'
import type { StreamSound } from '@/app/components/pages/events/pickban/stream/streamSound'
import { intermissionView } from './intermission/intermissionView'
import { MapHeadline } from './intermission/MapHeadline'
import { SeriesFinalCard } from './intermission/SeriesFinalCard'
import { SeriesTable } from './intermission/SeriesTable'
import { UpNextLine } from './intermission/UpNextLine'
import { useMapReveal } from './intermission/useMapReveal'

function IntermissionBody({ match, sound }: { match: StreamMatch; sound: StreamSound }) {
    const view = useMemo(() => intermissionView(match), [match])
    const reveal = useMapReveal(match, sound)

    return (
        <SceneFrame scene="intermission" title="Intermission" kicker={view.kicker}>
            <div className={view.final ? 'grid h-full grid-cols-[1060px_1fr] gap-x-10' : 'h-full'}>
                <div className="flex min-w-0 flex-col justify-center">
                    <MapHeadline match={match} latest={view.latest} reveal={reveal} />
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-[18px] shadow-2xl">
                        <SeriesTable maps={view.maps} series={view.series} teams={match.teams} reveal={reveal} layout={view.final ? 'beside' : 'full'} />
                    </div>
                    {view.upNext && <UpNextLine upNext={view.upNext} />}
                </div>
                {view.final && <SeriesFinalCard match={match} final={view.final} />}
            </div>
        </SceneFrame>
    )
}

export default function IntermissionScene({ options }: StreamSceneProps) {
    const { phase, match } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="intermission" />
    if (phase === 'idle') return <IdleFrame scene="intermission" />
    return <IntermissionBody key={match.id} match={match} sound={options.sound} />
}
