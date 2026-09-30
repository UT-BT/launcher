import { useMemo } from 'react'
import type { StreamMatch } from '../../data/streamHotState'
import { useSceneNow } from '../../data/useStreamData'
import { SceneFrame } from '../../frame/SceneFrame'
import { BlankFrame } from '../../frame/IdleFrame'
import { useStandingsFormat, useStandingsRead } from './standingsRead'
import { standingsView, type StandingsView } from './standingsView'
import { StandingsGroups } from './StandingsGroups'
import { StandingsSwiss } from './StandingsSwiss'
import { StandingsBracket } from './StandingsBracket'

const NOW_STEP_MS = 10_000

function Notice({ message }: { message: string }) {
    return (
        <div className="flex h-full items-center justify-center">
            <p className="text-4xl font-black italic uppercase text-white/55">{message}</p>
        </div>
    )
}

function Body({ view }: { view: StandingsView }) {
    if (view.kind === 'groups') return <StandingsGroups view={view} />
    if (view.kind === 'swiss') return <StandingsSwiss view={view} />
    if (view.kind === 'bracket') return <StandingsBracket view={view} />
    return <Notice message={view.message} />
}

export function StandingsStage({ eventSlug, match }: { eventSlug: string; match: StreamMatch }) {
    const { data, error } = useStandingsRead(eventSlug, match.id)
    const format = useStandingsFormat(eventSlug, data?.stage.kind === 'groups')
    const now = useSceneNow(NOW_STEP_MS)
    const view = useMemo(() => (data ? standingsView({ read: data, match, now, format }) : null), [data, match, now, format])

    if (!view) {
        if (!error) return <BlankFrame scene="standings" />
        return (
            <SceneFrame scene="standings" title="Standings">
                <Notice message="Standings are not available right now." />
            </SceneFrame>
        )
    }

    return (
        <SceneFrame scene="standings" title={view.title} kicker={view.kicker}>
            <Body view={view} />
        </SceneFrame>
    )
}
