import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { EASE_OUT } from '@/app/components/broadcast/broadcastMotion'
import { PANEL, SidePlate, StatCell, StatusRow } from './BettingParts'
import { coins, type BettingView, type OddsSide } from './bettingView'

type OpenView = Extract<BettingView, { kind: 'open' }>

function OddsBar({ share, fill }: { share: number; fill: string }) {
    return (
        <div className="h-4 max-w-[520px] flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.span
                className={cn('block h-full', fill)}
                initial={{ width: 0 }}
                animate={{ width: `${share * 100}%` }}
                transition={{ duration: 0.8, ease: EASE_OUT }}
            />
        </div>
    )
}

function TeamOdds({ entry }: { entry: OddsSide & { side: 'a' | 'b' } }) {
    const tone = PICK_BAN_TONES[entry.side]
    return (
        <SidePlate side={entry.side} className="h-[196px]">
            <div className="flex items-center gap-2.5">
                {entry.label && <span className="text-[18px] font-bold uppercase tracking-[0.2em] text-white/70">{entry.label}</span>}
            </div>
            <h2 className="max-w-full truncate text-[72px] font-black italic uppercase leading-[0.95] tracking-[-0.01em]">{entry.name}</h2>
            <div className="mt-1.5 flex items-center gap-7">
                <span className={cn('text-[64px] font-black italic leading-[0.9] tabular-nums', tone.text)}>{entry.percent}%</span>
                <span className="text-[30px] font-bold uppercase tracking-[0.1em] text-white/80">
                    Odds <b className="text-[40px] font-black italic text-white">{entry.odds}</b>
                </span>
                <OddsBar share={entry.share} fill={tone.solid} />
            </div>
        </SidePlate>
    )
}

function DrawOdds({ entry }: { entry: OddsSide }) {
    return (
        <div className="flex h-[72px] items-center gap-7 rounded-[10px] border border-white/10 bg-white/5 pl-11 pr-24">
            <span className="text-[40px] font-black italic uppercase leading-none">Draw</span>
            <span className="text-[40px] font-black italic leading-none tabular-nums text-white/80">{entry.percent}%</span>
            <span className="text-[24px] font-bold uppercase tracking-[0.1em] text-white/70">
                Odds <b className="text-[32px] font-black italic text-white">{entry.odds}</b>
            </span>
            <OddsBar share={entry.share} fill="bg-white/60" />
        </div>
    )
}

export function BettingOpen({ view }: { view: OpenView }) {
    const hasDraw = view.odds.some(entry => entry.side === 'draw')
    return (
        <div>
            <StatusRow status={view.status} right={view.totals} />
            <div className={cn('flex flex-col', hasDraw ? 'mt-4 gap-4' : 'mt-[22px] gap-[22px]')}>
                {view.odds.map(entry => (entry.side === 'draw'
                    ? <DrawOdds key="draw" entry={entry} />
                    : <TeamOdds key={entry.side} entry={{ ...entry, side: entry.side }} />))}
            </div>
            <div className={cn(PANEL, 'grid grid-cols-3 px-8 py-[26px]', hasDraw ? 'mt-5' : 'mt-7')}>
                <StatCell label="Pool" value={coins(view.pool)} sub="coins" />
                <StatCell label="Predictions" value={coins(view.predictions)} sub="so far" />
                <StatCell label="Market closes" value={view.closes.value} sub={view.closes.sub} />
            </div>
            <p className="mt-[18px] font-sans text-[22px] text-white/55">Who backed whom stays hidden until the market closes. Predict on utbt.net.</p>
        </div>
    )
}
