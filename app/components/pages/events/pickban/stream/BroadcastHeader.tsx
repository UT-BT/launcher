import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PICK_BAN_TONES, teamTone } from '@/app/components/broadcast/broadcastTone'
import { CHIP_MOTION } from '@/app/components/broadcast/broadcastMotion'
import { TeamPlate } from '@/app/components/broadcast/TeamPlate'
import { matchSubtitle } from '../pickBanCopy'
import type { PickBanTeamPanel, PickBanView } from '../pickBanView'

export function BroadcastHeader({ view, eventName }: { view: PickBanView; eventName: string | null }) {
    const lobby = view.stagePhase === 'lobby'

    return (
        <header className="relative z-10 flex h-[168px] shrink-0 items-stretch">
            <TeamPlate
                team={view.teams.left}
                align="left"
                lit={view.teams.left?.onTurn ?? false}
                chips={<PlateChips panel={view.teams.left} showReady={lobby} />}
            />
            <div className="flex w-[480px] shrink-0 flex-col items-center justify-center gap-1 px-6 text-center">
                {eventName && (
                    <p className="max-w-full truncate text-lg font-semibold uppercase tracking-[0.32em] text-white/55">{eventName}</p>
                )}
                <p className="text-[44px] font-black italic uppercase leading-none tracking-wide text-white">Picks &amp; Bans</p>
                <p className="max-w-full truncate text-lg font-semibold uppercase tracking-[0.14em] text-white/55">{matchSubtitle(view.match)}</p>
            </div>
            <TeamPlate
                team={view.teams.right}
                align="right"
                lit={view.teams.right?.onTurn ?? false}
                chips={<PlateChips panel={view.teams.right} showReady={lobby} />}
            />
        </header>
    )
}

function PlateChips({ panel, showReady }: { panel: PickBanTeamPanel | null; showReady: boolean }) {
    const tone = PICK_BAN_TONES[teamTone(panel?.ab ?? null)]

    return (
        <AnimatePresence initial={false}>
            {panel?.onTurn && (
                <motion.span
                    key="on-turn"
                    {...CHIP_MOTION}
                    className={cn('rounded-md px-2.5 py-0.5 text-lg font-black italic uppercase tracking-wider', tone.solid, tone.onSolid)}
                >
                    On the clock
                </motion.span>
            )}
            {showReady && panel && (
                <motion.span
                    key="ready"
                    {...CHIP_MOTION}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-0.5 text-lg font-black italic uppercase tracking-wider',
                        panel.ready ? 'border-emerald-400 bg-emerald-400/15 text-emerald-300' : 'border-white/15 text-white/45',
                    )}
                >
                    {panel.ready && <Check className="size-4" strokeWidth={3.5} />}
                    {panel.ready ? 'Ready' : 'Not ready'}
                </motion.span>
            )}
        </AnimatePresence>
    )
}
