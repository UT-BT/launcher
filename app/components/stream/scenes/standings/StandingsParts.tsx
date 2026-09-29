import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import type { StreamSide } from '../../data/streamHotState'
import { sideToneClasses } from '../../sceneHelpers'

export const PANEL = 'rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]'
export const KICKER = 'text-lg font-bold uppercase tracking-[0.3em] text-white/55'
export const LABEL = 'text-base font-bold uppercase tracking-[0.2em] text-white/60'
export const TEAM_NAME = 'truncate font-black italic uppercase'

export function Panel({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
    return <div className={cn(PANEL, className)} style={style}>{children}</div>
}

export function SideBadge({ side, size = 28 }: { side: StreamSide; size?: number }) {
    const tone = sideToneClasses(side)
    return (
        <span
            className={cn('inline-flex shrink-0 items-center justify-center rounded-md font-black italic leading-none', tone.solid, tone.onSolid)}
            style={{ width: size, height: size, fontSize: Math.round(size * 0.64) }}
        >
            {side.toUpperCase()}
        </span>
    )
}

export function sideWash(side: StreamSide | null, percent: number): CSSProperties | undefined {
    if (!side) return undefined
    const hue = PICK_BAN_HUES[side]
    return { background: tint(hue, percent), boxShadow: `inset 6px 0 0 ${hue}` }
}
