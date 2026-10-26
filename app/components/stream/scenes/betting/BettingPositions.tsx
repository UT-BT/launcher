import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { GroupPlate, profitTone, StatusRow } from './BettingParts'
import { BETTING_PARTS } from './bettingLayout'
import { signedCoins, type BackerRow, type BettingCells, type BettingColumns, type BettingFit, type BettingGroup, type BettingSlot, type BettingView } from './bettingView'

type PositionsView = Extract<BettingView, { groups: BettingGroup[] }>

interface Grid {
    columns: BettingColumns
    fit: BettingFit
    cells: BettingCells
}

interface Cell {
    width: number
    head: string
}

function gridCells({ columns, cells }: Grid): Cell[] {
    if (columns === 'locked') {
        return [
            { width: cells.stake, head: 'Stake' },
            { width: cells.payout, head: 'Payout' },
            ...(cells.multiplier === null ? [] : [{ width: cells.multiplier, head: 'Odds' }]),
        ]
    }
    return [
        { width: cells.stake, head: 'Stake' },
        { width: cells.payout, head: 'Payout' },
        { width: cells.profit, head: 'Profit' },
        { width: cells.chip, head: '' },
    ]
}

function template(grid: Grid): CSSProperties {
    return { gridTemplateColumns: ['minmax(0,1fr)', ...gridCells(grid).map(cell => `${cell.width}px`)].join(' ') }
}

const GRID = 'grid items-center gap-x-2 px-2'
const NUMBER = 'whitespace-nowrap text-right font-bold tabular-nums'

function Heads({ grid }: { grid: Grid }) {
    return (
        <div aria-hidden className={cn(GRID, 'mb-1 h-5 items-end')} style={template(grid)}>
            {['Bettor', ...gridCells(grid).map(cell => cell.head)].map((head, index) => (
                <span key={index} className={cn('whitespace-nowrap text-[14px] font-bold uppercase leading-none tracking-[0.14em] text-white/50', index > 0 && 'flex justify-end')}>{head}</span>
            ))}
        </div>
    )
}

function BackerName({ row, zoomed }: { row: BackerRow; zoomed: boolean }) {
    if (zoomed) {
        return (
            <div className="min-w-0 font-sans [zoom:1.5]">
                <PlayerInfo userId={row.userId} alias={row.name} size="sm" interactive={false} />
            </div>
        )
    }
    return (
        <div className="flex min-w-0 items-center gap-2.5 font-sans">
            <PlayerInfo userId={row.userId} alias={row.name} size="sm" presentation="avatar" interactive={false} />
            <div className="min-w-0 [zoom:1.5]">
                <PlayerInfo userId={row.userId} alias={row.name} size="sm" presentation="name" interactive={false} />
            </div>
        </div>
    )
}

function Amount({ text, size, className }: { text: string; size: number; className?: string }) {
    return <p className={cn(NUMBER, className)} style={{ fontSize: size }}>{text}</p>
}

function PayoutChip({ row, size }: { row: BackerRow; size: number }) {
    if (row.payoutChip === null) return <span />
    return (
        <span className="flex justify-end">
            <span
                className={cn(
                    'inline-flex items-center whitespace-nowrap rounded-md border-2 px-1.5 py-px font-black italic uppercase leading-[1.1] tracking-[0.05em]',
                    row.payoutChip === 'Pending' ? 'border-sky-400 bg-sky-400/15 text-sky-400' : 'border-emerald-400 bg-emerald-400/15 text-emerald-400',
                )}
                style={{ fontSize: size }}
            >
                {row.payoutChip}
            </span>
        </span>
    )
}

function BackerCells({ row, grid }: { row: BackerRow; grid: Grid }) {
    const { primary, secondary, chip } = grid.fit
    const stake = <Amount text={row.stake} size={secondary} className={row.biggest ? 'text-pickban-gold' : 'text-white/85'} />
    if (grid.columns === 'locked') {
        return (
            <>
                {stake}
                <Amount text={row.payout} size={primary} />
                {grid.cells.multiplier !== null && <Amount text={row.multiplier} size={secondary} className="text-white/65" />}
            </>
        )
    }
    return (
        <>
            {stake}
            <Amount text={row.payout} size={secondary} className={row.tone === 'lost' ? 'text-white/35' : 'text-white/85'} />
            <Amount text={signedCoins(row.profit ?? 0)} size={primary} className={profitTone(row.profit ?? 0)} />
            <PayoutChip row={row} size={chip} />
        </>
    )
}

function rowFill(row: BackerRow, zebra: boolean): string | false {
    if (row.tone === 'won') return zebra ? 'bg-emerald-400/[0.13]' : 'bg-emerald-400/[0.09]'
    return zebra && !row.biggest && 'bg-white/[0.03]'
}

function Backer({ row, zebra, grid }: { row: BackerRow; zebra: boolean; grid: Grid }) {
    return (
        <li
            data-biggest-bet={row.biggest || undefined}
            data-betting-tone={row.tone ?? undefined}
            className={cn(
                GRID,
                'rounded-lg',
                row.biggest && 'relative z-[1] bg-pickban-gold/10 shadow-[0_0_0_2px_var(--color-pickban-gold),0_0_24px_color-mix(in_srgb,var(--color-pickban-gold)_35%,transparent)]',
                rowFill(row, zebra),
                row.tone === 'lost' && '[&>*]:opacity-[0.42]',
            )}
            style={{ ...template(grid), height: grid.fit.rowHeight }}
        >
            <BackerName row={row} zoomed={grid.fit.avatarZoom} />
            <BackerCells row={row} grid={grid} />
        </li>
    )
}

function Note({ text, height }: { text: string; height: number }) {
    return (
        <p className="flex items-center whitespace-nowrap px-2 text-[17px] font-bold uppercase tracking-[0.12em] text-white/45" style={{ height }}>
            {text}
        </p>
    )
}

function Column({ slots, grid }: { slots: BettingSlot[]; grid: Grid }) {
    const backers = slots.flatMap(slot => (slot.kind === 'backer' ? [slot.row] : []))
    const notes = slots.flatMap(slot => (slot.kind === 'note' ? [slot.text] : []))
    return (
        <div className="flex min-w-0 flex-col" style={{ width: grid.fit.columnWidth }}>
            <Heads grid={grid} />
            {backers.length > 0 && (
                <ul>
                    {backers.map((row, index) => <Backer key={row.userId} row={row} zebra={index % 2 === 1} grid={grid} />)}
                </ul>
            )}
            {notes.map(text => <Note key={text} text={text} height={grid.fit.rowHeight} />)}
        </div>
    )
}

function Group({ group, grid }: { group: BettingGroup; grid: Grid }) {
    const count = group.columns.length
    const width = count * grid.fit.columnWidth + (count - 1) * BETTING_PARTS.columnGutter
    return (
        <section aria-label={group.name} data-betting-side={group.side} className="flex min-w-0 flex-col" style={{ width }}>
            <GroupPlate side={group.side} name={group.name} meta={group.meta} verdict={group.verdict} />
            <div className="mt-2 flex gap-4">
                {group.columns.map((slots, index) => <Column key={index} slots={slots} grid={grid} />)}
            </div>
        </section>
    )
}

export function BettingPositions({ view }: { view: PositionsView }) {
    const grid: Grid = { columns: view.columns, fit: view.fit, cells: view.cells }
    return (
        <div>
            <StatusRow status={view.status} legend={view.legend} />
            <div className="mt-3 flex gap-8">
                {view.groups.map(group => <Group key={group.side} group={group} grid={grid} />)}
            </div>
        </div>
    )
}
