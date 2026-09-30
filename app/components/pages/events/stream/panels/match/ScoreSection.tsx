import { useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { CHIP_SHAPE } from '@/app/components/shared/chipStyles'
import type { StreamScoreSource, StreamWinnerOverride } from '../../streamDesk'
import { StreamCard, StreamLoading } from '../../StreamCard'
import {
    clearMatchLive,
    markMatchLive,
    resetAllMapScores,
    resetMapScore,
    setLiveCounting,
    setMapScore,
    type BroadcastTarget,
    type MapScoreState,
} from './scoreActions'
import {
    buildScoreView,
    MAX_SCORE,
    MIN_SCORE,
    parseScoreInput,
    scoreWriteMessage,
    shouldSendTypedScore,
    stateWithPin,
    stateWithWinner,
    type ScoreMapRow,
    type ScoreSideCell,
    type ScoreWriteKind,
} from './scoreView'
import { useMatchWrite, useServerNow } from './useMatchWrite'
import { ACCENT_ACTION, ACTION_SHAPE, MUTED_ACTION } from './scoreControlStyles'

const SECTION_TITLE = 'Score'
const SECTION_DESCRIPTION = 'The match goes live when pick & ban ends, or when you mark it live. Set each map’s score and winner. What you set replaces the live count.'

const STEP_SHAPE = 'h-9 w-9 shrink-0 rounded-md border text-base font-semibold transition-colors cursor-pointer flex items-center justify-center disabled:cursor-default disabled:opacity-40'
const INPUT_SHAPE = 'h-9 w-14 shrink-0 rounded-md border bg-card/50 px-1 text-center text-base font-bold tabular-nums text-foreground focus:outline-none focus:border-accent-500/60 disabled:opacity-60'
const SELECT_SHAPE = 'h-9 min-w-0 max-w-full rounded-md border border-hairline/10 bg-card/50 px-2 text-xs text-foreground cursor-pointer focus:outline-none focus:border-accent-500/60 disabled:cursor-default disabled:opacity-60'
const CURRENT_STYLE = 'bg-accent-500/15 text-accent-200 border-accent-500/40'

const SOURCE_STYLES: Record<StreamScoreSource, string> = {
    official: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    live: 'bg-card/50 text-muted-foreground border-hairline/10',
    manual: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
}

type Write = (write: (target: BroadcastTarget) => Promise<unknown>) => Promise<void>

interface RowActions {
    pending: boolean
    version: number
    onState: (row: ScoreMapRow, state: MapScoreState) => void
    onReset: (row: ScoreMapRow) => void
    onInvalid: () => void
}

function SideScore({ row, cell, actions }: { row: ScoreMapRow; cell: ScoreSideCell; actions: RowActions }) {
    const where = `${cell.team} score on ${row.label.toLowerCase()}`
    const disabled = actions.pending || row.locked
    const edited = useRef(false)

    const commit = (input: HTMLInputElement) => {
        const value = parseScoreInput(input.value)
        const wasEdited = edited.current
        edited.current = false
        if (value === null) {
            input.value = String(cell.caps)
            actions.onInvalid()
            return
        }
        if (shouldSendTypedScore(cell, value, wasEdited)) actions.onState(row, stateWithPin(row, cell.side, value))
    }

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
            event.currentTarget.value = String(cell.caps)
            edited.current = false
        }
    }

    return (
        <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-sm text-foreground break-words">{cell.team}</span>
            <button
                type="button"
                disabled={disabled || !cell.canLower}
                onClick={() => actions.onState(row, stateWithPin(row, cell.side, cell.caps - 1))}
                aria-label={`Lower ${where}`}
                className={cn(STEP_SHAPE, MUTED_ACTION)}
            >
                −
            </button>
            <input
                key={`${actions.version}-${cell.caps}-${cell.pinned}`}
                type="number"
                inputMode="numeric"
                min={MIN_SCORE}
                max={MAX_SCORE}
                step={1}
                defaultValue={cell.caps}
                disabled={disabled}
                aria-label={where}
                onInput={() => { edited.current = true }}
                onBlur={event => commit(event.currentTarget)}
                onKeyDown={onKeyDown}
                className={cn(INPUT_SHAPE, cell.pinned ? 'border-amber-500/40' : 'border-hairline/10')}
            />
            <button
                type="button"
                disabled={disabled || !cell.canRaise}
                onClick={() => actions.onState(row, stateWithPin(row, cell.side, cell.caps + 1))}
                aria-label={`Raise ${where}`}
                className={cn(STEP_SHAPE, MUTED_ACTION)}
            >
                +
            </button>
        </div>
    )
}

function MapRow({ row, actions }: { row: ScoreMapRow; actions: RowActions }) {
    const disabled = actions.pending || row.locked
    const place = row.label.toLowerCase()

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
                    {' · '}{row.mapName ?? 'No map yet'}
                    {row.pickedText && <> · {row.pickedText}</>}
                    {row.resultText && <> · <span className="text-foreground">{row.resultText}</span></>}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {row.current && <span className={cn(CHIP_SHAPE, CURRENT_STYLE)}>Current</span>}
                    <span className={cn(CHIP_SHAPE, SOURCE_STYLES[row.source])}>{row.sourceLabel}</span>
                </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-x-6 lg:max-w-3xl">
                {row.sides.map(cell => <SideScore key={cell.side} row={row} cell={cell} actions={actions} />)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    Winner
                    <select
                        value={row.winner}
                        disabled={disabled}
                        aria-label={`Winner of ${place}`}
                        onChange={event => actions.onState(row, stateWithWinner(row, event.target.value as StreamWinnerOverride))}
                        style={{ colorScheme: 'dark' }}
                        className={SELECT_SHAPE}
                    >
                        {row.winnerOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </label>
                {row.hint && <p className="order-last w-full text-xs text-accent-200 break-words sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">{row.hint}</p>}
                {!row.locked && (
                    <button
                        type="button"
                        disabled={actions.pending || !row.canReset}
                        onClick={() => actions.onReset(row)}
                        aria-label={`Reset ${place} to live`}
                        className={cn(ACTION_SHAPE, MUTED_ACTION, 'ml-auto')}
                    >
                        Reset
                    </button>
                )}
            </div>
            {row.lockedNote && <p className="text-xs text-muted-foreground">{row.lockedNote}</p>}
        </li>
    )
}

function LiveCountingSwitch({ on, text, disabled, onToggle }: { on: boolean; text: string; disabled: boolean; onToggle: () => void }) {
    return (
        <div className="space-y-1">
            <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label="Live counting"
                disabled={disabled}
                onClick={onToggle}
                className="flex min-h-11 cursor-pointer items-center gap-3 text-left disabled:cursor-default disabled:opacity-60 sm:min-h-8"
            >
                <span
                    aria-hidden="true"
                    className={cn(
                        'flex h-5 w-9 shrink-0 items-center rounded-full border px-0.5 transition-colors',
                        on ? 'border-accent-500/60 bg-accent-500/30 justify-end' : 'border-hairline/20 bg-card/50 justify-start',
                    )}
                >
                    <span className={cn('size-3.5 rounded-full', on ? 'bg-accent-200' : 'bg-muted-foreground')} />
                </span>
                <span className="text-xs text-foreground">{on ? 'Live counting on' : 'Live counting off'}</span>
            </button>
            <p data-testid="live-counting-status" className="text-xs text-muted-foreground">{text}</p>
        </div>
    )
}

function scoreWrite(run: Write, kind: ScoreWriteKind, write: (target: BroadcastTarget) => Promise<unknown>): Promise<void> {
    return run(async target => {
        try {
            await write(target)
        } catch (error) {
            throw new Error(scoreWriteMessage(error, kind))
        }
    })
}

export function ScoreSection() {
    const { match, loading, loadError, clockOffsetMs, pending, writeError, run } = useMatchWrite()
    const now = useServerNow(clockOffsetMs)
    const [inputError, setInputError] = useState<string | null>(null)
    const [version, setVersion] = useState(0)
    const view = buildScoreView(match, now)

    if (!view) {
        return (
            <StreamCard title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
                {loading ? <StreamLoading label="the score" />
                    : loadError ? <p role="alert" className="text-xs text-red-300">The score could not be loaded. {loadError}</p>
                        : <p className="text-xs text-muted-foreground">No match on your scenes, so there is no score to set.</p>}
            </StreamCard>
        )
    }

    const write = async (kind: ScoreWriteKind, action: (target: BroadcastTarget) => Promise<unknown>) => {
        setInputError(null)
        await scoreWrite(run, kind, action)
        setVersion(current => current + 1)
    }

    const actions: RowActions = {
        pending,
        version,
        onState: (row, state) => void write('map', target => setMapScore(target, row.ordinal, state)),
        onReset: row => void write('reset', target => resetMapScore(target, row.ordinal)),
        onInvalid: () => setInputError(`Type a whole number from ${MIN_SCORE} to ${MAX_SCORE}.`),
    }
    const error = inputError ?? writeError

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
                    {view.canClearLive && (
                        <button type="button" disabled={pending} onClick={() => run(clearMatchLive)} className={cn(ACTION_SHAPE, MUTED_ACTION)}>
                            Clear live time
                        </button>
                    )}
                </div>
            </div>

            <LiveCountingSwitch
                on={view.liveCounting}
                text={view.liveCountingText}
                disabled={pending || view.finished}
                onToggle={() => void write('liveCounting', target => setLiveCounting(target, !view.liveCounting))}
            />

            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}

            {view.rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">No maps yet. They appear once the match has its maps.</p>
            ) : (
                <ul aria-label="Maps" className="space-y-2">
                    {view.rows.map(row => <MapRow key={row.ordinal} row={row} actions={actions} />)}
                </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                    <p data-testid="series-score" className="text-sm font-semibold text-foreground tabular-nums break-words">{view.seriesText}</p>
                    <p className="text-xs text-muted-foreground">Always counted from the map winners.</p>
                </div>
                <button
                    type="button"
                    disabled={pending || !view.canResetAll}
                    onClick={() => void write('resetAll', resetAllMapScores)}
                    className={cn(ACTION_SHAPE, MUTED_ACTION)}
                >
                    Reset all
                </button>
            </div>
        </StreamCard>
    )
}
