import { StrictMode, Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { ThemeProvider } from '@/app/theme/ThemeProvider'
import { PickBanMotion } from '@/app/components/pages/events/pickban/components/PickBanMotion'
import { isStreamSceneId, isTransparentStreamScene, type StreamSceneId, type StreamSceneRoute } from './streamScenes'
import { streamSceneOptionsOf, type StreamSceneOptions, type StreamSceneProps } from './streamSceneOptions'
import { UnknownScene } from './StreamSceneNotice'
import { StreamDataProvider } from './data/StreamDataProvider'

const SCENES: Record<StreamSceneId, LazyExoticComponent<ComponentType<StreamSceneProps>>> = {
    'starting-soon': lazy(() => import('./scenes/StartingSoonScene')),
    'preview': lazy(() => import('./scenes/PreviewScene')),
    'pick-ban': lazy(() => import('./scenes/PickBanScene')),
    'betting': lazy(() => import('./scenes/BettingScene')),
    'overlay': lazy(() => import('./scenes/OverlayScene')),
    'intermission': lazy(() => import('./scenes/IntermissionScene')),
    'post-match': lazy(() => import('./scenes/PostMatchScene')),
    'standings': lazy(() => import('./scenes/StandingsScene')),
    'brb': lazy(() => import('./scenes/BrbScene')),
    'ending': lazy(() => import('./scenes/EndingScene')),
    'caster': lazy(() => import('./scenes/CasterScene')),
}

function clearDocumentBackground(container: HTMLElement): void {
    for (const element of [document.documentElement, document.body, container]) {
        element.style.background = 'transparent'
    }
}

function StreamScene({ route, options }: { route: StreamSceneRoute; options: StreamSceneOptions }) {
    if (!isStreamSceneId(route.scene)) return <UnknownScene scene={route.scene} />
    const Scene = SCENES[route.scene]
    return (
        <StreamDataProvider eventSlug={route.eventSlug} streamerId={route.streamerId} options={options}>
            <PickBanMotion animate={options.animate}>
                <Suspense fallback={null}>
                    <Scene eventSlug={route.eventSlug} streamerId={route.streamerId} options={options} />
                </Suspense>
            </PickBanMotion>
        </StreamDataProvider>
    )
}

export function mountStreamSceneRoot(container: HTMLElement, route: StreamSceneRoute): void {
    if (isTransparentStreamScene(route.scene)) clearDocumentBackground(container)
    const options = streamSceneOptionsOf(window.location.search)
    ReactDOM.createRoot(container).render(
        <StrictMode>
            <ErrorBoundary>
                <ThemeProvider>
                    <StreamScene route={route} options={options} />
                </ThemeProvider>
            </ErrorBoundary>
        </StrictMode>
    )
}
