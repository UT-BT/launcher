import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Chip, profitTone, SideBadge, SidePlate, StatusRow, VerdictChip } from './BettingParts'
import { coins, plural, signedCoins, type BackerList, type BackerRow, type BettingColumns, type BettingView, type DrawLine } from './bettingView'

type PositionsView = Exclude<BettingView, { kind: 'not-enabled' | 'no-market' | 'open' }>

const COLUMNS: Record<BettingColumns, { template: string; heads: string[] }> = {
    locked: { template: '1fr 150px 210px 130px', heads: ['Backer', 'Stake', 'Locked payout', 'Multiplier'] },
    result: { template: '1fr 150px 190px 170px', heads: ['Backer', 'Stake', 'Profit', 'Payout'] },
}

const NUMBER = 'text-right text-[26px] font-bold tabular-nums'

function sideLine(odds: string, backers: number, staked: number): string {
    return `Odds ${odds} · ${plural(backers, 'backer', 'backers')} · ${coins(staked)} staked`
}

function Backer({ row }: { row: BackerRow }) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 font-sans [zoom:1.3]">
                <PlayerInfo userId={row.userId} alias={row.name} interactive={false} />
            </div>
            {row.biggest && <Chip tone="gold" className="text-[16px]">Biggest bet</Chip>}
        </div>
    )
}

function PayoutCell({ row }: { row: BackerRow }) {
    if (row.payoutChip === null) return <p className="text-right text-[20px] font-bold text-white/35">—</p>
    const paid = row.payoutChip !== 'Pending'
    return (
        <p className="text-right">
            <span className={cn(
                'inline-flex items-center rounded-md border-2 px-2.5 py-[3px] text-[16px] font-black italic uppercase leading-[1.1] tracking-[0.05em]',
                paid ? 'border-emerald-400 bg-emerald-400/15 text-emerald-400' : 'border-sky-400 bg-sky-400/15 text-sky-400',
            )}>
                {row.payoutChip}
            </span>
        </p>
    )
}

function BackerCells({ row, columns }: { row: BackerRow; columns: BettingColumns }) {
    if (columns === 'locked') {
        return (
            <>
                <p className={NUMBER}>{coins(row.payout)}</p>
                <p className={cn(NUMBER, 'text-white/70')}>{row.multiplier}</p>
            </>
        )
    }
    return (
        <>
            <p className={cn(NUMBER, row.profit === null ? 'text-white/35' : profitTone(row.profit))}>{row.profit === null ? '—' : signedCoins(row.profit)}</p>
            <PayoutCell row={row} />
        </>
    )
}

function BackerSection({ list, columns }: { list: BackerList; columns: BettingColumns }) {
    const { template, heads } = COLUMNS[columns]
    return (
        <section aria-label={list.name} data-betting-side={list.side} className="flex flex-col gap-1.5">
            <SidePlate side={list.side} className="h-[60px]">
                <div className="flex items-center justify-between gap-6">
                    <div className="flex min-w-0 items-center gap-3.5">
                        <SideBadge side={list.side} />
                        <h2 className="min-w-0 truncate text-[40px] font-black italic uppercase leading-[0.95] tracking-[-0.01em]">{list.name}</h2>
                        <VerdictChip verdict={list.verdict} />
                    </div>
                    <p className="shrink-0 text-[22px] font-bold uppercase tracking-[0.1em] text-white/75">{sideLine(list.odds, list.backers, list.staked)}</p>
                </div>
            </SidePlate>
            <div className="grid gap-4 px-4 pt-1.5" style={{ gridTemplateColumns: template }}>
                {heads.map((head, index) => (
                    <p key={head} className={cn('text-[15px] font-bold uppercase tracking-[0.16em] text-white/50', index > 0 && 'text-right')}>{head}</p>
                ))}
            </div>
            {list.rows.length === 0 ? (
                <p className="flex h-[46px] items-center px-4 text-[20px] font-bold uppercase tracking-[0.1em] text-white/45">No backers on this side</p>
            ) : (
                <ul>
                    {list.rows.map(row => (
                        <li
                            key={row.userId}
                            data-biggest-bet={row.biggest || undefined}
                            className={cn(
                                'grid h-[46px] items-center gap-4 rounded-[10px] px-4',
                                row.biggest && 'bg-pickban-gold/10 shadow-[0_0_0_2px_var(--color-pickban-gold),0_0_24px_color-mix(in_srgb,var(--color-pickban-gold)_35%,transparent)]',
                            )}
                            style={{ gridTemplateColumns: template }}
                        >
                            <Backer row={row} />
                            <p className={NUMBER}>{coins(row.stake)}</p>
                            <BackerCells row={row} columns={columns} />
                        </li>
                    ))}
                </ul>
            )}
            {list.more && (
                <p className="px-4 pt-0.5 text-[18px] font-bold uppercase tracking-[0.12em] text-white/45">+ {coins(list.more.count)} more · {coins(list.more.stake)} staked</p>
            )}
        </section>
    )
}

function AwaitingBanner() {
    return (
        <div className="flex h-11 items-center justify-center gap-[18px] rounded-[10px] border border-amber-400/40 bg-amber-400/[0.12]">
            <span className="text-[26px] font-black italic uppercase text-amber-300">Awaiting official result</span>
            <span className="text-[20px] font-bold uppercase tracking-[0.1em] text-white/60">Won/lost appears once an admin enters it</span>
        </div>
    )
}

function DrawStrip({ draw }: { draw: DrawLine }) {
    return (
        <section aria-label="Draw" data-betting-side="draw" className="flex h-11 items-center gap-4 rounded-[10px] border border-white/10 bg-white/5 px-4">
            <span className="text-[26px] font-black italic uppercase">Draw</span>
            <VerdictChip verdict={draw.verdict} />
            {draw.biggest && (
                <div data-biggest-bet className="flex min-w-0 items-center gap-3 rounded-[10px] bg-pickban-gold/10 px-3">
                    <Backer row={draw.biggest} />
                    <span className="text-[22px] font-bold tabular-nums">{coins(draw.biggest.stake)}</span>
                </div>
            )}
            <p className="ml-auto shrink-0 text-[20px] font-bold uppercase tracking-[0.1em] text-white/75">{sideLine(draw.odds, draw.backers, draw.staked)}</p>
        </section>
    )
}

export function BettingPositions({ view }: { view: PositionsView }) {
    const awaiting = view.kind === 'awaiting'
    const tight = awaiting || view.draw !== null
    return (
        <div>
            <StatusRow status={view.status} />
            <div className={cn('mt-2.5 flex flex-col', tight ? 'gap-3' : 'gap-[22px]')}>
                <BackerSection list={view.a} columns={view.columns} />
                {awaiting && <AwaitingBanner />}
                {view.draw && <DrawStrip draw={view.draw} />}
                <BackerSection list={view.b} columns={view.columns} />
            </div>
        </div>
    )
}
