import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { toActiveTitle } from '@/app/utils/api'
import { PANEL, profitTone } from './BettingParts'
import { signedCoins, type PredictorRow } from './bettingView'

export function TopPredictors({ rows }: { rows: PredictorRow[] }) {
    return (
        <aside aria-label="Top predictors" className={cn(PANEL, 'h-full px-7 py-[26px]')}>
            <div className="flex items-center justify-between">
                <p className="text-[18px] font-bold uppercase tracking-[0.3em] text-white/55">Top predictors</p>
                <p className="text-[15px] font-bold uppercase tracking-[0.2em] text-white/45">Cup-wide profit</p>
            </div>
            {rows.length === 0 ? (
                <p className="mt-16 text-center text-[24px] font-bold uppercase tracking-[0.1em] text-white/45">No predictions yet</p>
            ) : (
                <ol className="mt-[18px] flex flex-col gap-2.5">
                    {rows.map(row => (
                        <li key={row.userId} className="grid grid-cols-[56px_1fr_auto] items-center gap-3.5 border-t border-white/[0.08] py-3.5">
                            <span className={cn('text-[52px] font-black italic leading-[0.9] tabular-nums', row.rank === 1 ? 'text-pickban-gold' : 'text-white/80')}>{row.rank}</span>
                            <div className="min-w-0 font-sans [zoom:1.45]">
                                <PlayerInfo userId={row.userId} alias={row.name} title={toActiveTitle(row.title)} interactive={false} />
                            </div>
                            <div className="text-right">
                                <p className={cn('text-[30px] font-black italic tabular-nums', profitTone(row.profit))}>{signedCoins(row.profit)}</p>
                                <p className="text-[15px] font-bold uppercase tracking-[0.12em] text-white/50">{row.correct} correct</p>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
            <p className="absolute inset-x-7 bottom-6 text-center text-[20px] font-bold uppercase tracking-[0.14em] text-white/45">Predict on utbt.net</p>
        </aside>
    )
}
