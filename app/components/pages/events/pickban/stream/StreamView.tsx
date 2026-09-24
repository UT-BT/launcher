import { cn } from '@/lib/utils'
import { ApiError } from '@/app/utils/api'
import { usePickBanSession, usePickBanView } from '../usePickBanSession'
import { usePickBanPreload } from '../usePickBanPreload'
import { statusOfPhase } from '../pickBanStatus'
import type { PickBanView } from '../pickBanView'
import { CentreStage } from '../components/CentreStage'
import { PickBanMotion } from '../components/PickBanMotion'
import { PickBanStatusChip } from '../components/PickBanStatusChip'
import { StepTimeline } from '../components/StepTimeline'
import { TeamPanel } from '../components/TeamPanel'
import { StreamStage } from './StreamStage'

const PANEL_CLASS = 'w-[300px] shrink-0 rounded-none border-y-0'

interface StreamViewProps {
    eventSlug: string
    matchId: string
    muted: boolean
}

export function StreamView({ eventSlug, matchId, muted }: StreamViewProps) {
    const session = usePickBanSession({ accessToken: undefined, slug: eventSlug, matchId, alwaysPoll: true })
    const view = usePickBanView(session.state, session.clockOffsetMs)
    usePickBanPreload(view?.cards)

    return (
        <PickBanMotion>
            <StreamStage>
                <div data-sound-muted={muted} className="flex h-full w-full flex-col overflow-hidden text-foreground">
                    {view ? (
                        <StreamBody view={view} />
                    ) : session.loading ? (
                        <StreamSkeleton />
                    ) : (
                        <StreamUnavailable error={session.error} />
                    )}
                    {session.reconnecting && <ReconnectingDot />}
                </div>
            </StreamStage>
        </PickBanMotion>
    )
}

function StreamBody({ view }: { view: PickBanView }) {
    return (
        <>
            <TopBar view={view} />
            <div className="flex min-h-0 flex-1">
                <TeamPanel panel={view.teams.left} className={cn(PANEL_CLASS, 'border-l-0')} />
                <CentreStage view={view} className="min-h-0 min-w-0 flex-1 rounded-none border-0 bg-transparent" />
                <TeamPanel panel={view.teams.right} className={cn(PANEL_CLASS, 'border-r-0')} />
            </div>
            <BottomBar view={view} />
        </>
    )
}

function TopBar({ view }: { view: PickBanView }) {
    return (
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-hairline/10 px-10">
            <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-foreground">{view.match.title}</h1>
                <p className="truncate text-xs text-muted-foreground">
                    {[view.match.stageName, view.match.roundLabel, `Best of ${view.match.bestOf}`].filter(Boolean).join(' · ')}
                </p>
            </div>
            <PickBanStatusChip status={statusOfPhase(view.phase)} className="shrink-0" />
        </header>
    )
}

function BottomBar({ view }: { view: PickBanView }) {
    if (view.timeline.length === 0) return null
    return (
        <footer className="flex h-24 shrink-0 items-center justify-center border-t border-hairline/10 px-10">
            <StepTimeline entries={view.timeline} skippedBans={view.skippedBans} />
        </footer>
    )
}

function ReconnectingDot() {
    return (
        <div
            role="status"
            className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-card px-2.5 py-1.5 text-xs font-medium text-amber-300"
        >
            Reconnecting…
        </div>
    )
}

function StreamSkeleton() {
    return (
        <div aria-busy className="flex h-full w-full items-center justify-center">
            <div className="h-64 w-64 animate-pulse rounded-xl bg-hairline/5" />
        </div>
    )
}

function StreamUnavailable({ error }: { error: unknown }) {
    const hidden = error instanceof ApiError && [401, 403, 404].includes(error.status)
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center">
            <h2 className="text-lg font-semibold text-foreground">
                {hidden ? 'This pick/ban isn’t available' : 'Couldn’t load this pick/ban'}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
                {hidden
                    ? 'The match may not be published yet, or the link is wrong.'
                    : 'Trying again in the background.'}
            </p>
        </div>
    )
}
