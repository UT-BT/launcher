import { useMemo } from 'react'
import type { StreamSceneProps } from '../streamSceneOptions'
import type { StreamMatch } from '../data/streamHotState'
import { useSceneMatch, useSceneNow, useSceneRead } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { SceneFrame } from '../frame/SceneFrame'
import { bettingReadPath, type BettingRead } from './betting/bettingRead'
import { bettingView, type BettingView } from './betting/bettingView'
import { BettingOpen } from './betting/BettingOpen'
import { BettingPositions } from './betting/BettingPositions'
import { NoMarket, PredictionsNotEnabled } from './betting/BettingNotices'

const NOW_STEP_MS = 10_000

function BettingMarket({ view }: { view: Exclude<BettingView, { kind: 'not-enabled' }> }) {
    if (view.kind === 'no-market') return <NoMarket />
    if (view.kind === 'open') return <BettingOpen view={view} />
    return <BettingPositions view={view} />
}

function BettingBody({ view }: { view: BettingView }) {
    if (view.kind === 'not-enabled') return <PredictionsNotEnabled />
    return (
        <div data-betting-kind={view.kind} className="h-full min-w-0 leading-[1.2]">
            <BettingMarket view={view} />
        </div>
    )
}

function BettingMatch({ eventSlug, match }: { eventSlug: string; match: StreamMatch }) {
    const { data } = useSceneRead<BettingRead>(bettingReadPath(eventSlug, match.id))
    const now = useSceneNow(NOW_STEP_MS)
    const read = data?.match_id === match.id ? data : null
    const view = useMemo(() => (read ? bettingView(read, match, now) : null), [read, match, now])

    return (
        <SceneFrame scene="betting" title="Predictions" kicker={view?.kind === 'open' ? view.kicker : null}>
            {view && <BettingBody view={view} />}
        </SceneFrame>
    )
}

export default function BettingScene({ eventSlug }: StreamSceneProps) {
    const { phase, match } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="betting" />
    if (phase === 'idle') return <IdleFrame scene="betting" />
    return <BettingMatch key={match.id} eventSlug={eventSlug} match={match} />
}
