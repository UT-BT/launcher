import { cn } from '@/lib/utils'
import { usePickBanSession, usePickBanView } from '../usePickBanSession'
import { usePickBanPreload } from '../usePickBanPreload'
import { statusOfPhase } from '../pickBanStatus'
import { matchSubtitle } from '../pickBanCopy'
import type { PickBanView } from '../pickBanView'
import { CentreStage } from '../components/CentreStage'
import { PickBanMotion } from '../components/PickBanMotion'
import { PickBanStatusChip } from '../components/PickBanStatusChip'
import { PickBanUnavailable } from '../components/PickBanUnavailable'
import { PoolGrid } from '../components/PoolGrid'
import { StepTimeline } from '../components/StepTimeline'
import { TeamPanel } from '../components/TeamPanel'
import { StreamStage } from './StreamStage'

const PANEL_CLASS = 'w-[300px] shrink-0 rounded-none border-y-0'

const POOL_GRID_CLASS = cn(
    'grid-cols-[repeat(auto-fit,minmax(4.5rem,4.5rem))] justify-center gap-1.5',
    '@3xl/grid:grid-cols-[repeat(auto-fit,minmax(4.5rem,4.5rem))] @3xl/grid:justify-center @3xl/grid:gap-1.5',
    '@7xl/grid:grid-cols-[repeat(auto-fit,minmax(4.5rem,4.5rem))] @7xl/grid:justify-center',
    '@[140rem]/grid:grid-cols-[repeat(auto-fit,minmax(4.5rem,4.5rem))] @[140rem]/grid:justify-center @[140rem]/grid:gap-1.5',
)

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
                        <PickBanUnavailable error={session.error} className="h-full w-full" />
                    )}
                    {session.reconnecting && <ReconnectingBadge />}
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
                <p className="truncate text-xs text-muted-foreground">{matchSubtitle(view.match)}</p>
            </div>
            <PickBanStatusChip status={statusOfPhase(view.phase)} className="shrink-0" />
        </header>
    )
}

function BottomBar({ view }: { view: PickBanView }) {
    if (view.timeline.length === 0) return null
    return (
        <footer className="flex shrink-0 flex-col gap-3 border-t border-hairline/10 px-10 py-4">
            <StepTimeline entries={view.timeline} skippedBans={view.skippedBans} className="justify-center" />
            <PoolGrid cards={view.cards} previewActor={view.turn?.ab ?? null} className={POOL_GRID_CLASS} />
        </footer>
    )
}

function ReconnectingBadge() {
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
