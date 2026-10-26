import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { profitTone } from '../betting/BettingParts'
import type { StandingsDensity } from './predictorStandingsFit'
import type { PredictorStandingsView, StandingsMove, StandingsRowView, StandingsWidths } from './predictorStandingsView'

const NUMBER = 'flex justify-end whitespace-nowrap font-bold tabular-nums'
const HEAD = 'whitespace-nowrap text-[14px] font-bold uppercase leading-none tracking-[0.14em] text-white/50'

const MOVE_TONE: Record<Exclude<StandingsMove['kind'], 'new'>, string> = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    same: 'text-white/30',
}

function template(widths: StandingsWidths): string {
    return ['auto', 'auto', 'minmax(0,1fr)', 'auto', widths.chip > 0 && 'auto', 'auto'].filter(Boolean).join(' ')
}

function Predictor({ row, density }: { row: StandingsRowView; density: StandingsDensity }) {
    if (density.zoomed) {
        return (
            <div className="min-w-0 font-sans [zoom:1.5]">
                <PlayerInfo userId={row.userId} alias={row.name} title={density.title ? row.title : null} size="sm" interactive={false} />
            </div>
        )
    }
    return (
        <div className="flex min-w-0 items-center gap-2.5 font-sans">
            <PlayerInfo userId={row.userId} alias={row.name} presentation="avatar" size="sm" interactive={false} className="shrink-0" />
            <div className="min-w-0 [zoom:1.5]">
                <PlayerInfo userId={row.userId} alias={row.name} title={null} presentation="name" size="sm" interactive={false} />
            </div>
        </div>
    )
}

function Move({ move, width, density }: { move: StandingsMove | null; width: number; density: StandingsDensity }) {
    if (move?.kind === 'new') {
        return (
            <span data-standings-move="new" className="flex items-center" style={{ width }}>
                <span
                    className={cn(
                        'inline-flex items-center rounded-[5px] px-[5px] py-px font-black italic uppercase leading-[1.1] tracking-[0.05em]',
                        PICK_BAN_TONES.gold.solid,
                        PICK_BAN_TONES.gold.onSolid,
                    )}
                    style={{ fontSize: density.chip - 2 }}
                >
                    {move.text}
                </span>
            </span>
        )
    }
    return (
        <span
            data-standings-move={move?.kind}
            className={cn('flex items-center whitespace-nowrap font-bold tabular-nums', move && MOVE_TONE[move.kind])}
            style={{ width, fontSize: density.move }}
        >
            {move?.text}
        </span>
    )
}

function Row({ row, zebra, view }: { row: StandingsRowView; zebra: boolean; view: PredictorStandingsView }) {
    const { density, widths } = view
    const style: CSSProperties = { height: view.fit.rowHeight, gridTemplateColumns: template(widths) }
    return (
        <li data-standings-row={row.rank} className={cn('grid min-w-0 items-center gap-x-1.5 rounded-lg px-1.5', zebra && 'bg-white/[0.03]')} style={style}>
            <span
                className={cn('block text-right font-black italic leading-none tabular-nums', row.first ? PICK_BAN_TONES.gold.text : 'text-white/80')}
                style={{ width: widths.rank, fontSize: density.rank }}
            >
                {row.rank}
            </span>
            <Move move={row.move} width={widths.move} density={density} />
            <Predictor row={row} density={density} />
            <p className={cn(NUMBER, profitTone(row.profit))} style={{ width: widths.profit, fontSize: density.primary }}>{row.profitText}</p>
            {widths.chip > 0 && (
                <span className="flex justify-end" style={{ width: widths.chip }}>
                    {row.pending && (
                        <span
                            className="inline-flex items-center whitespace-nowrap rounded-md border-2 border-sky-400 bg-sky-400/15 px-1.5 py-px font-black italic uppercase leading-[1.1] tracking-[0.05em] text-sky-400"
                            style={{ fontSize: density.chip }}
                        >
                            Pending
                        </span>
                    )}
                </span>
            )}
            <p className={cn(NUMBER, 'text-white/60')} style={{ width: widths.record, fontSize: density.secondary }}>{row.record}</p>
        </li>
    )
}

function Heads({ view }: { view: PredictorStandingsView }) {
    const { widths } = view
    return (
        <div className="mb-1.5 grid h-[22px] items-end gap-x-1.5 px-1.5" style={{ gridTemplateColumns: template(widths) }}>
            <span className={cn(HEAD, 'text-right')} style={{ width: widths.rank }}>#</span>
            <span style={{ width: widths.move }} />
            <span className={HEAD}>Predictor</span>
            <span className={cn(HEAD, 'text-right')} style={{ width: widths.profit }}>Profit</span>
            {widths.chip > 0 && <span style={{ width: widths.chip }} />}
            <span className={cn(HEAD, 'text-right')} style={{ width: widths.record }}>Won</span>
        </div>
    )
}

export function PredictorStandingsBoard({ view }: { view: PredictorStandingsView }) {
    if (view.empty) {
        return (
            <div data-predictor-standings="empty" className="flex h-full items-center justify-center">
                <p className="text-[28px] font-bold uppercase tracking-[0.1em] text-white/45">No predictions yet</p>
            </div>
        )
    }
    const last = view.columns.length - 1
    return (
        <div
            data-predictor-standings
            data-row-height={view.fit.rowHeight}
            data-columns={view.fit.columns}
            className="flex h-full gap-6 leading-[1.2]"
        >
            {view.columns.map((column, index) => (
                <div key={column[0].userId} className="flex min-w-0 shrink-0 flex-col" style={{ width: view.fit.columnWidth }}>
                    <Heads view={view} />
                    <ol>
                        {column.map((row, rowIndex) => (
                            <Row key={row.userId} row={row} zebra={rowIndex % 2 === 1} view={view} />
                        ))}
                    </ol>
                    {index === last && view.more && (
                        <p
                            data-standings-more
                            className="flex items-center whitespace-nowrap px-2 text-[17px] font-bold uppercase tracking-[0.12em] text-white/45"
                            style={{ height: view.fit.rowHeight }}
                        >
                            {view.more}
                        </p>
                    )}
                </div>
            ))}
        </div>
    )
}
