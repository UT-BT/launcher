import { useMemo, type ReactNode } from 'react'
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
import { TopPredictors } from './betting/TopPredictors'

const NOW_STEP_MS = 10_000

function BettingBody({ view }: { view: BettingView }) {
    if (view.kind === 'not-enabled') return <PredictionsNotEnabled />
    let market: ReactNode
    if (view.kind === 'no-market') market = <NoMarket />
    else if (view.kind === 'open') market = <BettingOpen view={view} />
    else market = <BettingPositions view={view} />
    return (
        <div data-betting-kind={view.kind} className="grid h-full grid-cols-[1fr_520px] gap-x-10 leading-[1.2]">
            <div className="min-w-0">{market}</div>
            <TopPredictors rows={view.leaderboard} />
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
