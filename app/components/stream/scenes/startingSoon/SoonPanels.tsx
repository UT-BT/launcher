import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import { sideToneClasses } from '../../sceneHelpers'
import type { AlsoTodayRow, CountdownView, OddsShare, OddsView } from './startingSoonView'

const KICKER = 'text-lg leading-tight font-bold uppercase tracking-[0.3em] text-white/55'
const LABEL = 'text-lg leading-tight font-bold uppercase tracking-[0.2em] text-white/60'
const BIG = 'font-black italic uppercase tabular-nums [text-shadow:0_6px_30px_rgba(0,0,0,0.6)]'
const GOLD = PICK_BAN_TONES.gold.text
const SEGMENT_GAP = { borderLeft: '3px solid #05070c' }
const NOTE_TONE: Record<AlsoTodayRow['note']['kind'], string> = {
    final: 'text-white/50',
    channel: 'text-white/85',
    none: 'text-white/40',
}

export function SoonPanel({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
    return (
        <div className={cn('relative rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl', className)} style={style}>
            {children}
        </div>
    )
}

export function SoonCountdown({ countdown, stage, format }: { countdown: CountdownView; stage: string; format: string }) {
    const ticking = countdown.state === 'future'
    return (
        <SoonPanel className="shrink-0 text-center" style={{ padding: '30px 36px 28px' }}>
            <p className={KICKER}>{countdown.label}</p>
            <p data-soon-countdown={countdown.state} className={BIG} style={{ fontSize: ticking ? 160 : 112, lineHeight: 0.9, marginTop: ticking ? 6 : 24 }}>
                {countdown.headline}
            </p>
            {countdown.utc && (
                <p className="font-bold uppercase" style={{ marginTop: ticking ? 14 : 22, fontSize: 30, letterSpacing: '0.08em' }}>
                    {countdown.utc}
                    {countdown.relative && (
                        <>
                            {' · '}
                            <span className={GOLD}>{countdown.relative}</span>
                        </>
                    )}
                </p>
            )}
            <div className="h-px bg-white/10" style={{ margin: '22px 0 18px' }} />
            <p className="font-black italic uppercase" style={{ fontSize: 30 }}>
                {stage}
            </p>
            <p className={cn(LABEL, 'mt-2')}>{format}</p>
        </SoonPanel>
    )
}

function OddsSide({ side, share }: { side: 'A' | 'B'; share: OddsShare }) {
    const tone = sideToneClasses(side === 'A' ? 'a' : 'b')
    return (
        <p data-soon-odds={side} className={cn('font-black italic uppercase', tone.text)} style={{ fontSize: 28 }}>
            {share.text}
        </p>
    )
}

export function SoonOdds({ odds }: { odds: OddsView }) {
    return (
        <SoonPanel className="shrink-0" style={{ marginTop: 34, padding: '22px 32px' }}>
            <p className={KICKER} style={{ marginBottom: 12 }}>
                Community odds
            </p>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                <OddsSide side="A" share={odds.a} />
                {odds.draw && (
                    <p className="font-black italic uppercase text-white/60" style={{ fontSize: 22 }}>
                        {odds.draw.text}
                    </p>
                )}
                <OddsSide side="B" share={odds.b} />
            </div>
            <div className="flex overflow-hidden rounded-full bg-white/10" style={{ height: 14 }}>
                <span className={sideToneClasses('a').solid} style={{ width: `${odds.a.share * 100}%` }} />
                {odds.draw && <span className="bg-white/35" style={{ ...SEGMENT_GAP, width: `${odds.draw.share * 100}%` }} />}
                <span className={sideToneClasses('b').solid} style={{ ...SEGMENT_GAP, width: `${odds.b.share * 100}%` }} />
            </div>
            <p className={cn(LABEL, 'text-center')} style={{ marginTop: 12, fontSize: 16 }}>
                {odds.summary}
            </p>
        </SoonPanel>
    )
}

function AlsoTodayItem({ row }: { row: AlsoTodayRow }) {
    return (
        <li data-soon-also={row.id} className="grid items-center border-t border-white/10" style={{ gridTemplateColumns: '150px 1fr auto', gap: 18, padding: '10px 0' }}>
            <div>
                <p className="font-bold" style={{ fontSize: 24 }}>
                    {row.time}
                </p>
                <p className="uppercase text-white/55" style={{ fontSize: 17, letterSpacing: '0.08em' }}>
                    {row.relative}
                </p>
            </div>
            <div className="min-w-0">
                <p className="truncate font-black italic uppercase" style={{ fontSize: 24 }}>
                    {row.a} {row.score ? <span className={GOLD}>{row.score}</span> : <span className="text-white/50">vs</span>} {row.b}
                </p>
                <p className="truncate uppercase text-white/50" style={{ fontSize: 16, letterSpacing: '0.14em' }}>
                    {row.where}
                </p>
            </div>
            <p className={cn('text-right font-bold', NOTE_TONE[row.note.kind])} style={{ fontSize: 18 }}>
                {row.note.text}
            </p>
        </li>
    )
}

export function SoonAlsoToday({ rows }: { rows: AlsoTodayRow[] }) {
    return (
        <SoonPanel className="min-h-0 flex-1 overflow-hidden" style={{ padding: '22px 30px 6px' }}>
            <p className={KICKER} style={{ marginBottom: 6 }}>
                Also today
            </p>
            {rows.length > 0 ? (
                <ul>
                    {rows.map(row => (
                        <AlsoTodayItem key={row.id} row={row} />
                    ))}
                </ul>
            ) : (
                <p className="border-t border-white/10 text-white/50" style={{ fontSize: 22, padding: '18px 0' }}>
                    No other matches today
                </p>
            )}
        </SoonPanel>
    )
}
