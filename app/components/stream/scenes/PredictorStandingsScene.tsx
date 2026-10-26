import { useMemo } from 'react'
import type { StreamSceneProps } from '../streamSceneOptions'
import { useSceneMatch, useSceneRead } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { SceneFrame } from '../frame/SceneFrame'
import { predictorStandingsReadPath, type PredictorStandings } from './standings/predictorStandingsRead'
import { predictorStandingsView } from './standings/predictorStandingsView'
import { STANDINGS_BOX } from './standings/predictorStandingsFit'
import { PredictorStandingsBoard } from './standings/PredictorStandingsBoard'

function PredictorStandingsStage({ eventSlug, matchId }: { eventSlug: string; matchId: string | null }) {
    const { data } = useSceneRead<PredictorStandings>(predictorStandingsReadPath(eventSlug, matchId))
    const view = useMemo(() => (data ? predictorStandingsView(data, STANDINGS_BOX) : null), [data])

    return (
        <SceneFrame scene="predictor-standings" title="Predictor Standings" kicker={view?.kicker ?? null}>
            {view && <PredictorStandingsBoard view={view} />}
        </SceneFrame>
    )
}

export default function PredictorStandingsScene({ eventSlug }: StreamSceneProps) {
    const { phase, state, match } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="predictor-standings" />
    if (state === null) return <IdleFrame scene="predictor-standings" />
    const matchId = match?.id ?? null
    return <PredictorStandingsStage key={matchId ?? 'no-match'} eventSlug={eventSlug} matchId={matchId} />
}
