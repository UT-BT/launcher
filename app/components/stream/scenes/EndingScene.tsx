import { useSceneNow, useSceneRead, useStreamData, useStreamHotState } from '../data/useStreamData'
import { BlankFrame, IdleFrame } from '../frame/IdleFrame'
import { SceneFrame } from '../frame/SceneFrame'
import { CreditsPanel, NextMatches } from '../ending/EndingViews'
import { endingModel } from '../ending/endingModel'
import { streamFeedPath, type StreamFeed } from '../ticker/streamFeed'

export default function EndingScene() {
    const { eventSlug, streamerId } = useStreamData()
    const { state, loading } = useStreamHotState()
    const { data: feed } = useSceneRead<StreamFeed>(streamFeedPath(eventSlug, streamerId))
    const now = useSceneNow()

    if (!state) return loading ? <BlankFrame scene="ending" /> : <IdleFrame scene="ending" />

    const model = endingModel({ state, feed, now })
    return (
        <SceneFrame scene="ending" title="Thanks for watching" kicker={model.kicker}>
            <div className="grid h-full grid-cols-[600px_1fr] gap-x-12">
                <CreditsPanel streamer={model.streamer} casters={model.casters} eventName={state.event.name} />
                <NextMatches matches={model.next} />
            </div>
        </SceneFrame>
    )
}
