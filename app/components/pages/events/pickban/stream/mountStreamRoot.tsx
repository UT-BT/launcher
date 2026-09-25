import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { ThemeProvider } from '@/app/theme/ThemeProvider'
import type { StreamRouteParams } from '@/app/components/navigation/matchLinks'
import { StreamView } from './StreamView'
import { isStreamSoundMuted } from './streamSound'
import { isStreamMotionOff } from '../pickBanMotionPreference'

export function mountStreamRoot(container: HTMLElement, params: StreamRouteParams): void {
    const muted = isStreamSoundMuted(window.location.search)
    const animate = !isStreamMotionOff(window.location.search)
    ReactDOM.createRoot(container).render(
        <StrictMode>
            <ErrorBoundary>
                <ThemeProvider>
                    <StreamView eventSlug={params.eventSlug} matchId={params.matchId} muted={muted} animate={animate} />
                </ThemeProvider>
            </ErrorBoundary>
        </StrictMode>
    )
}
