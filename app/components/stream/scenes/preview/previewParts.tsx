import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { staggeredCard } from '@/app/components/broadcast/broadcastMotion'
import { sideToneClasses } from '../../sceneHelpers'
import type { StreamSide } from '../../data/streamHotState'
import type { ResultLetter } from './previewView'

export const RESULT_TEXT: Record<ResultLetter, string> = {
    W: 'text-emerald-500',
    D: 'text-white/60',
    L: 'text-red-400',
}

export function Kicker({ className, children }: { className?: string; children: ReactNode }) {
    return <p className={cn('text-lg font-bold uppercase leading-tight tracking-[0.3em] text-white/55', className)}>{children}</p>
}

export function Label({ className, children }: { className?: string; children: ReactNode }) {
    return <p className={cn('text-base font-bold uppercase leading-tight tracking-[0.2em] text-white/60', className)}>{children}</p>
}

export function Panel({ order, className, children }: { order: number; className?: string; children: ReactNode }) {
    return (
        <motion.div
            variants={staggeredCard(order)}
            initial="hidden"
            animate="shown"
            className={cn('relative min-h-0 rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]', className)}
        >
            {children}
        </motion.div>
    )
}

export function SideBadge({ side, className }: { side: StreamSide; className?: string }) {
    const tone = sideToneClasses(side)
    return (
        <span className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-md text-lg font-black italic uppercase', tone.solid, tone.onSolid, className)}>
            {side}
        </span>
    )
}
