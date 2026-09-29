import { motion } from 'framer-motion'
import { FADE_MOTION } from '@/app/components/broadcast/broadcastMotion'
import type { ConsequenceLine } from './postMatchView'
import { SideChip } from './SeriesTable'

export function ConsequencePanel({ lines }: { lines: ConsequenceLine[] }) {
    return (
        <motion.section
            {...FADE_MOTION}
            aria-label="What it means"
            data-post-match-consequence
            className="mt-[26px] flex max-w-full items-center gap-7 rounded-3xl border border-white/10 bg-white/4 px-8 py-[22px] shadow-2xl shadow-black/50"
        >
            <p className="shrink-0 text-lg font-bold uppercase tracking-[0.3em] text-pickban-gold">What it means</p>
            <ul className="flex min-w-0 flex-col gap-2">
                {lines.map(line => (
                    <li key={line.side} className="flex min-w-0 items-center gap-3.5 text-[30px] font-bold uppercase leading-tight tracking-[0.04em]">
                        <SideChip side={line.side} />
                        <span className="min-w-0 text-balance">
                            {line.team}: {line.text}
                        </span>
                    </li>
                ))}
            </ul>
        </motion.section>
    )
}
