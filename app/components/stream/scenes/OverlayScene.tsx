import { useSceneMatch } from '../data/useStreamData'
import { BlankFrame } from '../frame/IdleFrame'
import { OverlayFrame } from '../frame/SceneFrame'
import { OverlayHub } from './overlay/OverlayHub'
import { OverlayNameTag } from './overlay/OverlayNameTag'
import { overlayView } from './overlay/overlayView'

export default function OverlayScene() {
    const { phase, match } = useSceneMatch()

    if (phase === 'loading') return <BlankFrame scene="overlay" transparent />
    const view = overlayView(match)
    return (
        <OverlayFrame scene="overlay">
            {view && match && (
                <div data-stream-match={match.id} className="absolute inset-0 font-semibold leading-[1.2]">
                    {view.tags.map(tag => (
                        <OverlayNameTag key={tag.slot} tag={tag} />
                    ))}
                    <OverlayHub view={view} />
                </div>
            )}
        </OverlayFrame>
    )
}
