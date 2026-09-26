import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { toActiveTitle } from '@/app/utils/api'
import { matchSubtitle } from '../pickBanCopy'
import type { PickBanTeamPanel, PickBanView } from '../pickBanView'
import { PICK_BAN_HUES, PICK_BAN_TONES, teamTone, tint } from '../components/pickBanTone'
import { CHIP_MOTION } from '../components/stageMotion'

type PlateAlign = 'left' | 'right'

const PLATE_CLIP: Record<PlateAlign, string> = {
    left: 'polygon(0 0, 100% 0, calc(100% - 56px) 100%, 0 100%)',
    right: 'polygon(0 0, 100% 0, 100% 100%, 56px 100%)',
}

function plateNameSize(name: string): number {
    if (name.length > 20) return 46
    if (name.length > 15) return 54
    return 64
}

export function BroadcastHeader({ view, eventName }: { view: PickBanView; eventName: string | null }) {
    const lobby = view.stagePhase === 'lobby'

    return (
        <header className="relative z-10 flex h-[168px] shrink-0 items-stretch">
            <TeamPlate panel={view.teams.left} align="left" showReady={lobby} />
            <div className="flex w-[480px] shrink-0 flex-col items-center justify-center gap-1 px-6 text-center">
                {eventName && (
                    <p className="max-w-full truncate text-lg font-semibold uppercase tracking-[0.32em] text-white/55">{eventName}</p>
                )}
                <p className="text-[44px] font-black italic uppercase leading-none tracking-wide text-white">Picks &amp; Bans</p>
                <p className="max-w-full truncate text-lg font-semibold uppercase tracking-[0.14em] text-white/55">{matchSubtitle(view.match)}</p>
            </div>
            <TeamPlate panel={view.teams.right} align="right" showReady={lobby} />
        </header>
    )
}

function TeamPlate({ panel, align, showReady }: { panel: PickBanTeamPanel | null; align: PlateAlign; showReady: boolean }) {
    const toneKey = teamTone(panel?.ab ?? null)
    const tone = PICK_BAN_TONES[toneKey]
    const hue = PICK_BAN_HUES[toneKey]
    const onTurn = panel?.onTurn ?? false
    const mirrored = align === 'right'
    const direction = mirrored ? 'to left' : 'to right'

    return (
        <section aria-label={panel?.name ?? 'Team to be decided'} className="relative min-w-0 flex-1">
            <div
                aria-hidden
                className="absolute inset-0 transition-opacity duration-500"
                style={{
                    clipPath: PLATE_CLIP[align],
                    background: `linear-gradient(${direction}, ${tint(hue, 34)}, ${tint(hue, 12)} 55%, ${tint(hue, 4)})`,
                }}
            />
            <motion.div
                aria-hidden
                initial={false}
                animate={{ opacity: onTurn ? 1 : 0 }}
                transition={{ duration: 0.45 }}
                className="absolute inset-0"
                style={{
                    clipPath: PLATE_CLIP[align],
                    background: `linear-gradient(${direction}, ${tint(hue, 60)}, ${tint(hue, 22)} 60%, ${tint(hue, 8)})`,
                }}
            />
            <div aria-hidden className={cn('absolute inset-y-0 w-2', mirrored ? 'right-0' : 'left-0', tone.solid)} />
            <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-px"
                style={{ clipPath: PLATE_CLIP[align], background: `linear-gradient(${direction}, ${hue}, transparent 85%)` }}
            />
            <div className={cn('relative flex h-full min-w-0 flex-col justify-center gap-2.5', mirrored ? 'items-end pl-24 pr-12 text-right' : 'items-start pl-12 pr-24')}>
                <div className={cn('flex items-center gap-2.5', mirrored && 'flex-row-reverse')}>
                    {panel?.ab && (
                        <span className={cn('inline-flex size-7 items-center justify-center rounded-md text-lg font-black italic', tone.solid, tone.onSolid)}>
                            {panel.ab}
                        </span>
                    )}
                    {panel?.stageSeed != null && (
                        <span className="text-lg font-bold uppercase tracking-[0.2em] text-white/70">Seed {panel.stageSeed}</span>
                    )}
                    <AnimatePresence initial={false}>
                        {onTurn && (
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
                </div>
                <h2
                    className="max-w-full truncate font-black italic uppercase leading-[0.9] tracking-tight text-white [text-shadow:0_4px_24px_rgba(0,0,0,0.45)]"
                    style={{ fontSize: plateNameSize(panel?.name ?? '') }}
                >
                    {panel?.name ?? 'TBD'}
                </h2>
                {panel && (
                    <ul className={cn('flex min-w-0 max-w-full items-center gap-6 font-sans [zoom:1.3]', mirrored && 'flex-row-reverse')}>
                        {panel.members.map(member => (
                            <li key={member.id} className="min-w-0">
                                <PlayerInfo
                                    userId={member.id}
                                    alias={member.display_name}
                                    title={toActiveTitle(member.title)}
                                    size="md"
                                    interactive={false}
                                    className={cn(mirrored && 'flex-row-reverse text-right')}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    )
}
