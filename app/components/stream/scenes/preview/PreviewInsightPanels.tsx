import { cn } from '@/lib/utils'
import { sideToneClasses } from '../../sceneHelpers'
import type { HeadToHeadView, OddsView } from './previewView'
import { Kicker, Label, Panel } from './previewParts'

export function HeadToHeadPanel({ headToHead, order }: { headToHead: HeadToHeadView; order: number }) {
    const meetings = headToHead.draws > 0 ? `${headToHead.meetings} · ${headToHead.draws} drawn` : headToHead.meetings

    return (
        <Panel order={order} className="shrink-0 px-7 py-[22px]">
            <Kicker>Head-to-head</Kicker>
            <div data-preview-h2h className="mt-3.5 flex items-center justify-between gap-4">
                <p className={cn('w-16 text-[72px] font-black italic leading-[0.9] tabular-nums', sideToneClasses('a').text)}>{headToHead.wins.a}</p>
                <div className="min-w-0 text-center leading-tight">
                    <p className="text-[22px] font-bold uppercase tracking-[0.12em]">{meetings}</p>
                    {headToHead.last && <p className="mt-1 truncate text-[17px] uppercase tracking-[0.08em] text-white/55">{headToHead.last}</p>}
                    {headToHead.lastResult && <p className="truncate text-[17px] uppercase tracking-[0.08em] text-white/55">{headToHead.lastResult}</p>}
                </div>
                <p className={cn('w-16 text-right text-[72px] font-black italic leading-[0.9] tabular-nums', sideToneClasses('b').text)}>{headToHead.wins.b}</p>
            </div>
        </Panel>
    )
}

export function OddsPanel({ odds, order }: { odds: OddsView; order: number }) {
    return (
        <Panel order={order} className="flex-1 px-7 py-[22px]">
            <Kicker className="mb-3.5">Odds</Kicker>
            <div data-preview-odds className="mb-3 flex items-center justify-between text-[28px] font-black italic uppercase">
                <p className="flex items-center gap-2.5">
                    <span className={sideToneClasses('a').text}>{odds.a.percent}</span>
                    <span className="text-white/85">{odds.a.odds}</span>
                </p>
                {odds.draw && <Label className="text-lg">{`Draw ${odds.draw.percent} · ${odds.draw.odds}`}</Label>}
                <p className="flex items-center gap-2.5">
                    <span className="text-white/85">{odds.b.odds}</span>
                    <span className={sideToneClasses('b').text}>{odds.b.percent}</span>
                </p>
            </div>
            <div className="flex h-3.5 overflow-hidden rounded-full bg-white/10">
                <span className={sideToneClasses('a').solid} style={{ width: `${odds.a.share * 100}%` }} />
                {odds.draw && <span className="border-l-[3px] border-[#05070c] bg-white/30" style={{ width: `${odds.draw.share * 100}%` }} />}
                <span className={cn('border-l-[3px] border-[#05070c]', sideToneClasses('b').solid)} style={{ width: `${odds.b.share * 100}%` }} />
            </div>
            <Label className="mt-3 text-center">{odds.totals}</Label>
            <p className="mt-3.5 text-center font-sans text-lg text-white/50">{odds.note}</p>
        </Panel>
    )
}
