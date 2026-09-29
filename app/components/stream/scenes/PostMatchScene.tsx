import type { StreamSceneProps } from '../streamSceneOptions'
import { useSceneMatch } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { PostMatchBody } from './postMatch/PostMatchBody'

export default function PostMatchScene({ eventSlug, options }: StreamSceneProps) {
    const { phase, match } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="post-match" />
    if (phase === 'idle') return <IdleFrame scene="post-match" />
    return <PostMatchBody key={match.id} eventSlug={eventSlug} match={match} options={options} />
}
