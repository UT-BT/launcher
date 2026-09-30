import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { CHIP_SHAPE } from '@/app/components/shared/chipStyles'
import { MATCH_STATUS_LABELS, MATCH_STATUS_STYLES } from '@/app/components/pages/events/bracket/bracketShared'
import { StreamCard, StreamLoading } from '../../StreamCard'
import { useStreamTab } from '../../StreamTabContext'
import { moveToNextMatch, setCurrentMatch } from './currentMatchActions'
import { buildCurrentMatchView, type CurrentMatchRow } from './currentMatchView'

const CLOCK_TICK_MS = 30_000
const SECTION_TITLE = 'Current match'
const SECTION_DESCRIPTION = 'Your assigned matches, the one your scenes show now, and the next match.'

const ACTION_SHAPE = 'h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2 disabled:cursor-default disabled:opacity-50'
const ACCENT_ACTION = 'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:border-accent-500/60'
const MUTED_ACTION = 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20'
const NOT_PUBLIC_STYLE = 'bg-amber-500/10 text-amber-300 border-amber-500/30'
const ON_SCREEN_STYLE = 'bg-accent-500/15 text-accent-200 border-accent-500/40'

function errorText(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Something went wrong.'
}

function useServerNow(clockOffsetMs: number): number {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
        return () => clearInterval(timer)
    }, [])

    return now + clockOffsetMs
}

function Chip({ className, children }: { className: string; children: string }) {
    return <span className={cn(CHIP_SHAPE, className)}>{children}</span>
}

function MatchSummary({ row }: { row: CurrentMatchRow }) {
    return (
        <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-foreground break-words">{row.title}</p>
            <p className="text-xs text-muted-foreground break-words">{row.detail}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{row.timeText}</p>
        </div>
    )
}

function MatchChips({ row }: { row: CurrentMatchRow }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <Chip className={MATCH_STATUS_STYLES[row.status]}>{MATCH_STATUS_LABELS[row.status]}</Chip>
            {row.onScreen && <Chip className={ON_SCREEN_STYLE}>On screen</Chip>}
            {row.notPublic && <Chip className={NOT_PUBLIC_STYLE}>Not public yet</Chip>}
        </div>
    )
}

function NotScheduled() {
    return (
        <div role="status" className="space-y-1 rounded-lg border border-hairline/10 bg-card/40 p-3">
            <p className="text-sm font-semibold text-foreground">You're set up, just not scheduled yet</p>
            <p className="text-xs text-muted-foreground">
                No matches in this event are assigned to you yet. A manager assigns streamers from the match queue, and your matches show up here as soon as they do. Until then your scenes show the event branding.
            </p>
            <p className="text-xs text-muted-foreground">Meanwhile, download the OBS kit on the Setup tab and read the Guide.</p>
        </div>
    )
}

export function CurrentMatchSection() {
    const { eventSlug, streamerId, accessToken, desk, deskLoading, deskError, clockOffsetMs, refresh } = useStreamTab()
    const now = useServerNow(clockOffsetMs)
    const writing = useRef(false)
    const [pending, setPending] = useState(false)
    const [writeError, setWriteError] = useState<string | null>(null)

    const run = async (write: () => Promise<unknown>) => {
        if (writing.current) return
        writing.current = true
        setPending(true)
        setWriteError(null)
        try {
            await write()
        } catch (error) {
            setWriteError(errorText(error))
        } finally {
            await refresh()
            writing.current = false
            setPending(false)
        }
    }

    const choose = (matchId: string | null) => run(() => setCurrentMatch(accessToken, eventSlug, streamerId, matchId))
    const next = () => run(() => moveToNextMatch(accessToken, eventSlug, streamerId))

    if (!desk) {
        return (
            <StreamCard title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
                {deskLoading || !deskError
                    ? <StreamLoading label="your matches" />
                    : <p role="alert" className="text-xs text-red-300">Your matches could not be loaded. {errorText(deskError)}</p>}
            </StreamCard>
        )
    }

    const view = buildCurrentMatchView(desk, now)
    const retryNote = deskError !== null && (
        <p className="text-xs text-amber-300">Could not refresh your matches, retrying. {errorText(deskError)}</p>
    )

    if (view.rows.length === 0) {
        return (
            <StreamCard title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
                <NotScheduled />
                {retryNote}
            </StreamCard>
        )
    }

    return (
        <StreamCard title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
            <div className="space-y-2 rounded-lg border border-hairline/10 bg-card/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">On your scenes now</p>
                {view.onScreen ? (
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <MatchSummary row={view.onScreen} />
                        <MatchChips row={view.onScreen} />
                    </div>
                ) : (
                    <p className="text-sm text-foreground">No match</p>
                )}
                <p data-testid="current-match-reason" className="text-xs text-muted-foreground">{view.reasonText}</p>
                {view.chosenNote && <p className="text-xs text-amber-300">{view.chosenNote}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    disabled={pending || !view.next}
                    onClick={next}
                    className={cn(ACTION_SHAPE, ACCENT_ACTION)}
                >
                    Next match
                </button>
                <span className="min-w-0 text-xs text-muted-foreground break-words">
                    {view.next ? `${view.next.title} · ${view.next.timeText}` : 'No later match to move to.'}
                </span>
                {view.chosenId && (
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => choose(null)}
                        className={cn(ACTION_SHAPE, MUTED_ACTION, 'sm:ml-auto')}
                    >
                        Choose automatically
                    </button>
                )}
            </div>

            {writeError && <p role="alert" className="text-xs text-red-300">{writeError}</p>}
            {!writeError && retryNote}

            <div className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground">Your assigned matches</h3>
                <ul aria-label="Assigned matches" className="space-y-2">
                    {view.rows.map(row => (
                        <li
                            key={row.id}
                            className={cn(
                                'flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3',
                                row.onScreen ? 'border-accent-500/40 bg-accent-500/5' : 'border-hairline/10 bg-card/30',
                            )}
                        >
                            <div className="min-w-0 space-y-1.5">
                                <MatchSummary row={row} />
                                <MatchChips row={row} />
                            </div>
                            <button
                                type="button"
                                disabled={pending || row.chosen}
                                onClick={() => choose(row.id)}
                                aria-label={row.chosen ? `${row.title} is the current match` : `Set ${row.title} as the current match`}
                                className={cn(ACTION_SHAPE, row.chosen ? ACCENT_ACTION : MUTED_ACTION, 'shrink-0')}
                            >
                                {row.chosen ? 'Current' : 'Set current'}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </StreamCard>
    )
}
