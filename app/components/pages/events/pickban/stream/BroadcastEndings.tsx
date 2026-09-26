import { motion } from 'framer-motion'
import { Ban, CircleSlash, Pause, Star, Trophy, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import type { PickBanSummaryEntry } from '../pickBanView'
import { PICK_BAN_HUES, PICK_BAN_TONES, stepTone, tint } from '../components/pickBanTone'
import { FADE_MOTION, staggeredCard } from '../components/stageMotion'

const LINEUP_CARD_MAX = 300

const LINEUP_WIDTH = 1760

const LINEUP_GAP = 28

export function BroadcastLineup({ entries, edited }: { entries: PickBanSummaryEntry[]; edited: boolean }) {
    const card = Math.min(LINEUP_CARD_MAX, Math.floor((LINEUP_WIDTH - LINEUP_GAP * (entries.length - 1)) / Math.max(1, entries.length)))

    return (
        <div className="flex w-full flex-col items-center gap-10">
            <div className="flex flex-col items-center gap-1 text-center">
                <p className="flex items-center gap-2 text-lg font-bold uppercase tracking-[0.3em] text-pickban-gold">
                    <Trophy className="size-5" />
                    Picks &amp; Bans complete
                    {edited && <span className="ml-2 rounded border border-amber-400/40 bg-amber-400/10 px-2 text-base tracking-wider text-amber-300">Edited</span>}
                </p>
                <p className="text-[56px] font-black italic uppercase leading-none text-white">Maps in play order</p>
            </div>
            <ol className="flex items-start justify-center" style={{ gap: LINEUP_GAP }}>
                {entries.map((entry, order) => {
                    const toneKey = stepTone(entry.decider ? null : entry.ab)
                    const tone = PICK_BAN_TONES[toneKey]
                    const hue = PICK_BAN_HUES[toneKey]
                    const name = entry.map ? displayMapName(entry.map) : null
                    return (
                        <motion.li key={entry.key} variants={staggeredCard(order)} className="flex flex-col items-center gap-3" style={{ width: card }}>
                            <span className="sr-only">{`Map ${entry.mapNumber}: ${name ?? 'To be decided'}, ${entry.decider ? 'decider' : `picked by ${entry.actorLabel}`}`}</span>
                            <div
                                aria-hidden
                                className={cn('relative aspect-square w-full overflow-hidden rounded-2xl border-4 bg-white/[0.04]', tone.border)}
                                style={{ boxShadow: `0 0 40px ${tint(hue, 35)}, 0 18px 40px rgba(0,0,0,0.55)` }}
                            >
                                {entry.map && (
                                    <MapThumbnail mapName={entry.map} version={entry.screenshotVersion} size="hero" alt="" className="absolute inset-0 size-full rounded-none border-0" />
                                )}
                                <span className={cn('absolute left-3 top-3 flex items-center gap-1.5 rounded-lg px-3 py-1 text-[28px] font-black italic uppercase leading-none shadow-lg', tone.solid, tone.onSolid)}>
                                    {entry.decider && <Star className="size-5 fill-current" />}
                                    Map {entry.mapNumber}
                                </span>
                            </div>
                            <p aria-hidden className="w-full truncate text-center text-[32px] font-bold uppercase leading-none tracking-wide text-white">{name ?? 'To be decided'}</p>
                            <p aria-hidden className={cn('w-full truncate text-center text-xl font-bold uppercase leading-none tracking-[0.14em]', tone.text)}>
                                {entry.decider ? 'Decider' : `Picked by ${entry.actorLabel}`}
                            </p>
                        </motion.li>
                    )
                })}
            </ol>
        </div>
    )
}

export function BroadcastNotice({ kind, reason, detail }: { kind: 'cancelled' | 'voided'; reason: string | null; detail: string }) {
    const Icon: LucideIcon = kind === 'cancelled' ? Ban : CircleSlash
    return (
        <div className="flex max-w-[1100px] flex-col items-center gap-4 text-center">
            <Icon className="size-16 text-white/50" />
            <p className="text-[64px] font-black italic uppercase leading-none text-white">Picks &amp; Bans {kind}</p>
            {reason && <p className="line-clamp-2 break-words font-sans text-3xl text-white/85">{reason}</p>}
            <p className="font-sans text-2xl text-white/50">{detail}</p>
        </div>
    )
}

export function BroadcastPaused() {
    return (
        <motion.div data-stage-part="paused" {...FADE_MOTION} className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070c]/90">
            <div className="flex items-center gap-6 rounded-3xl border border-white/10 bg-white/[0.04] px-12 py-8 shadow-2xl">
                <span className="flex size-20 items-center justify-center rounded-full bg-accent-500/20 text-accent-200">
                    <Pause className="size-10 fill-current" />
                </span>
                <div className="text-left">
                    <p className="text-[64px] font-black italic uppercase leading-none text-white">Paused</p>
                    <p className="text-2xl font-bold uppercase tracking-[0.18em] text-white/55">Waiting for an admin to resume</p>
                </div>
            </div>
        </motion.div>
    )
}
