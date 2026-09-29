import { cn } from '@/lib/utils'
import { CHIP_SHAPE } from '@/app/components/shared/chipStyles'
import type { StreamScoreSource } from '../../streamDesk'
import { StreamCard, StreamLoading } from '../../StreamCard'
import { adjustMapScore, clearMatchLive, clearScoreOverrides, markMatchLive } from './scoreActions'
import { buildScoreView, type ScoreMapRow, type ScoreSideCell } from './scoreView'
import { useMatchWrite, useServerNow } from './useMatchWrite'
import { ACCENT_ACTION, ACTION_SHAPE, MUTED_ACTION } from './scoreControlStyles'

const SECTION_TITLE = 'Score'
const SECTION_DESCRIPTION = 'Mark the match live and correct the live score map by map.'

const STEP_SHAPE = 'h-9 w-9 shrink-0 rounded-md border text-base font-semibold transition-colors cursor-pointer flex items-center justify-center disabled:cursor-default disabled:opacity-40'
const CURRENT_STYLE = 'bg-accent-500/15 text-accent-200 border-accent-500/40'

const SOURCE_STYLES: Record<StreamScoreSource, string> = {
    official: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    live: 'bg-card/50 text-muted-foreground border-hairline/10',
    override: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
}

interface StepProps {
    row: ScoreMapRow
    cell: ScoreSideCell
    pending: boolean
    onStep: (ordinal: number, cell: ScoreSideCell, delta: 1 | -1) => void
}

function SideRow({ row, cell, pending, onStep }: StepProps) {
    const where = `on ${row.label.toLowerCase()}`
    return (
        <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-sm text-foreground break-words">{cell.team}</span>
            <button
                type="button"
                disabled={pending || !cell.canRemove}
                onClick={() => onStep(row.ordinal, cell, -1)}
                aria-label={`Remove a cap from ${cell.team} ${where}`}
                className={cn(STEP_SHAPE, MUTED_ACTION)}
            >
                −
            </button>
            <output
                aria-label={`${cell.team} caps ${where}`}
                className="w-8 text-center text-lg font-bold tabular-nums text-foreground"
            >
                {cell.caps}
            </output>
            <button
                type="button"
                disabled={pending || !cell.canAdd}
                onClick={() => onStep(row.ordinal, cell, 1)}
                aria-label={`Add a cap to ${cell.team} ${where}`}
                className={cn(STEP_SHAPE, MUTED_ACTION)}
            >
                +
            </button>
        </div>
    )
}

function MapCard({ row, pending, onStep }: { row: ScoreMapRow; pending: boolean; onStep: StepProps['onStep'] }) {
    return (
        <li
            aria-label={row.label}
            className={cn(
                'space-y-2 rounded-lg border p-3',
                row.current ? 'border-accent-500/40 bg-accent-500/5' : 'border-hairline/10 bg-card/30',
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-xs text-muted-foreground break-words">
                    <span className="font-semibold text-foreground">{row.label}</span>
                    {row.mapName && <> · {row.mapName}</>}
                    {row.winnerText && <> · {row.winnerText}</>}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {row.current && <span className={cn(CHIP_SHAPE, CURRENT_STYLE)}>Current</span>}
                    <span className={cn(CHIP_SHAPE, SOURCE_STYLES[row.source])}>{row.sourceLabel}</span>
                </div>
            </div>
            {row.sides.map(cell => <SideRow key={cell.side} row={row} cell={cell} pending={pending} onStep={onStep} />)}
            {row.lockedNote && <p className="text-xs text-muted-foreground">{row.lockedNote}</p>}
        </li>
    )
}

export function ScoreSection() {
    const { match, loading, loadError, clockOffsetMs, pending, writeError, run } = useMatchWrite()
    const now = useServerNow(clockOffsetMs)
    const view = buildScoreView(match, now)

    if (!view) {
        return (
            <StreamCard title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
                {loading ? <StreamLoading label="the score" />
                    : loadError ? <p role="alert" className="text-xs text-red-300">The score could not be loaded. {loadError}</p>
                        : <p className="text-xs text-muted-foreground">No match on your scenes, so there is no score to correct.</p>}
            </StreamCard>
        )
    }

    const step = (ordinal: number, cell: ScoreSideCell, delta: 1 | -1) =>
        run(target => adjustMapScore(target, ordinal, cell.side, delta))

    return (
        <StreamCard title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
            <div className="space-y-2 rounded-lg border border-hairline/10 bg-card/40 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Match live</p>
                <p data-testid="match-live-status" className="text-xs text-foreground">{view.liveText}</p>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(markMatchLive)}
                        className={cn(ACTION_SHAPE, ACCENT_ACTION)}
                    >
                        {view.liveSet ? 'Mark live again now' : 'Match live'}
                    </button>
                    {view.liveSet && (
                        <button type="button" disabled={pending} onClick={() => run(clearMatchLive)} className={cn(ACTION_SHAPE, MUTED_ACTION)}>
                            Clear live time
                        </button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-sm font-semibold text-foreground tabular-nums break-words">{view.seriesText}</p>
                <button
                    type="button"
                    disabled={pending || view.finished}
                    onClick={() => run(clearScoreOverrides)}
                    className={cn(ACTION_SHAPE, MUTED_ACTION)}
                >
                    Clear overrides
                </button>
            </div>

            {writeError && <p role="alert" className="text-xs text-red-300">{writeError}</p>}

            {view.rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No maps yet. They appear once the match has its maps.</p>
            ) : (
                <ul aria-label="Maps" className="grid gap-2 sm:grid-cols-2">
                    {view.rows.map(row => <MapCard key={row.ordinal} row={row} pending={pending} onStep={step} />)}
                </ul>
            )}
        </StreamCard>
    )
}
