import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PICK_BAN_HUES, PICK_BAN_TONES, tint } from '@/app/components/broadcast/broadcastTone'
import type { StreamSide } from '../../data/streamHotState'
import type { BettingStatus, BettingTone, BettingVerdict } from './bettingView'

export type ChipTone = BettingTone | 'gold' | 'red'

const CHIP_TONES: Record<ChipTone, string> = {
    emerald: 'bg-emerald-400 text-neutral-950',
    amber: 'bg-amber-400 text-neutral-950',
    sky: 'bg-sky-400 text-neutral-950',
    neutral: 'bg-white/15 text-white',
    gold: 'bg-pickban-gold text-neutral-950',
    red: 'bg-red-400 text-neutral-950',
}

export function profitTone(profit: number): string {
    if (profit > 0) return 'text-emerald-300'
    if (profit < 0) return 'text-red-300'
    return 'text-white/60'
}

const PLATE_CLIP = 'polygon(0 0, 100% 0, calc(100% - 56px) 100%, 0 100%)'

export function Chip({ tone, className, children }: { tone: ChipTone; className?: string; children: ReactNode }) {
    return (
        <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2.5 py-[3px] text-[18px] font-black italic uppercase leading-[1.1] tracking-[0.05em]', CHIP_TONES[tone], className)}>
            {children}
        </span>
    )
}

export function VerdictChip({ verdict }: { verdict: BettingVerdict | null }) {
    if (verdict === null) return null
    return <Chip tone={verdict === 'won' ? 'emerald' : 'red'}>{verdict === 'won' ? 'Won' : 'Lost'}</Chip>
}

export function SidePlate({ side, className, children }: { side: StreamSide; className: string; children: ReactNode }) {
    const hue = PICK_BAN_HUES[side]
    return (
        <section className={cn('relative min-w-0', className)}>
            <div
                aria-hidden
                className="absolute inset-0"
                style={{ clipPath: PLATE_CLIP, background: `linear-gradient(to right, ${tint(hue, 34)}, ${tint(hue, 12)} 55%, ${tint(hue, 4)})` }}
            />
            <div aria-hidden className={cn('absolute inset-y-0 left-0 w-2', PICK_BAN_TONES[side].solid)} />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-px" style={{ clipPath: PLATE_CLIP, background: `linear-gradient(to right, ${hue}, transparent 85%)` }} />
            <div className="relative flex h-full min-w-0 flex-col justify-center gap-2.5 pl-11 pr-24">{children}</div>
        </section>
    )
}

export function StatusRow({ status, right }: { status: BettingStatus; right?: string }) {
    return (
        <div data-betting-status className="flex h-[52px] items-center gap-4">
            <Chip tone={status.tone}>{status.chip}</Chip>
            <p className="min-w-0 truncate text-[24px] font-bold uppercase tracking-[0.1em] text-white/75">{status.text}</p>
            {right && <p className="ml-auto shrink-0 text-[22px] font-bold uppercase tracking-[0.1em] text-white/60">{right}</p>}
        </div>
    )
}

export function StatCell({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div>
            <p className="text-[15px] font-bold uppercase tracking-[0.16em] text-white/55">{label}</p>
            <p className="mt-1.5 text-[46px] font-black italic leading-[0.9] tabular-nums">{value}</p>
            <p className="mt-1 text-[16px] uppercase tracking-[0.08em] text-white/60">{sub}</p>
        </div>
    )
}

export const PANEL = 'relative rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl'
