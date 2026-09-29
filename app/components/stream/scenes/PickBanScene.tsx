import { StreamView } from '@/app/components/pages/events/pickban/stream/StreamView'
import type { StreamSceneProps } from '../streamSceneOptions'
import { useSceneMatch } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'

export default function PickBanScene({ eventSlug, options }: StreamSceneProps) {
    const { phase, match } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="pick-ban" />
    if (phase === 'idle') return <IdleFrame scene="pick-ban" />
    return (
        <div data-stream-scene="pick-ban" data-stream-match={match.id} className="fixed inset-0">
            <StreamView key={match.id} eventSlug={eventSlug} matchId={match.id} sound={options.sound} animate={options.animate} />
        </div>
    )
}
