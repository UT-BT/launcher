import { cn } from '@/lib/utils'
import { StreamCard, StreamLoading } from '../../StreamCard'
import { useStreamTab } from '../../StreamTabContext'
import { setWebcamFrame } from './showActions'
import { useShowWrite } from './useShowWrite'

const TITLE = 'Webcam frame'
const DESCRIPTION = 'Turn the Caster Cam frame on when you have a webcam in it, and off when you do not.'

export function WebcamSection() {
    const { eventSlug, streamerId, accessToken, desk } = useStreamTab()
    const { run, pending, error } = useShowWrite()

    if (!desk) {
        return (
            <StreamCard title={TITLE} description={DESCRIPTION}>
                <StreamLoading label="your show settings" />
            </StreamCard>
        )
    }

    const enabled = desk.desk.webcam_enabled

    return (
        <StreamCard title={TITLE} description={DESCRIPTION}>
            <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Show a webcam frame"
                disabled={pending}
                onClick={() => void run(() => setWebcamFrame(accessToken, eventSlug, streamerId, !enabled))}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-left disabled:cursor-default disabled:opacity-60 sm:min-h-8"
            >
                <span
                    aria-hidden="true"
                    className={cn(
                        'flex h-5 w-9 shrink-0 items-center rounded-full border px-0.5 transition-colors',
                        enabled ? 'border-accent-500/60 bg-accent-500/30 justify-end' : 'border-hairline/20 bg-card/50 justify-start',
                    )}
                >
                    <span className={cn('size-3.5 rounded-full', enabled ? 'bg-accent-200' : 'bg-muted-foreground')} />
                </span>
                <span className="text-xs text-foreground">{enabled ? 'Webcam frame on' : 'Webcam frame off'}</span>
            </button>
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        </StreamCard>
    )
}
