import type { StreamSceneProps } from '../streamSceneOptions'
import { useSceneMatch } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { StandingsStage } from './standings/StandingsStage'

export default function StandingsScene({ eventSlug }: StreamSceneProps) {
    const { phase, match } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="standings" />
    if (phase === 'idle') return <IdleFrame scene="standings" />
    return <StandingsStage key={match.id} eventSlug={eventSlug} match={match} />
}
