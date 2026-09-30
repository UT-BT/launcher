import type { StreamSceneProps } from '../streamSceneOptions'
import { useSceneMatch } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { StartingSoonBoard } from './startingSoon/StartingSoonBoard'

export default function StartingSoonScene({ eventSlug, streamerId, options }: StreamSceneProps) {
    const { phase, match } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="starting-soon" />
    if (phase === 'idle') return <IdleFrame scene="starting-soon" />
    return <StartingSoonBoard key={match.id} eventSlug={eventSlug} streamerId={streamerId} match={match} sound={options.sound} />
}
