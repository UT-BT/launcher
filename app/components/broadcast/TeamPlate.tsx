import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { toActiveTitle, type PickBanActor, type RawActiveTitle } from '@/app/utils/api'
import { PICK_BAN_HUES, PICK_BAN_TONES, teamTone, tint } from './broadcastTone'

export type PlateAlign = 'left' | 'right'

export interface PlateMember {
    id: string
    display_name: string
    title: RawActiveTitle | null
}

export interface PlateTeam {
    ab: PickBanActor | null
    name: string
    stageSeed: number | null
    members: PlateMember[]
}

const PLATE_CLIP: Record<PlateAlign, string> = {
    left: 'polygon(0 0, 100% 0, calc(100% - 56px) 100%, 0 100%)',
    right: 'polygon(0 0, 100% 0, 100% 100%, 56px 100%)',
}

function plateNameSize(name: string): number {
    if (name.length > 20) return 46
    if (name.length > 15) return 54
    return 64
}

export function TeamPlate({ team, align, lit = false, chips }: { team: PlateTeam | null; align: PlateAlign; lit?: boolean; chips?: ReactNode }) {
    const toneKey = teamTone(team?.ab ?? null)
    const tone = PICK_BAN_TONES[toneKey]
    const hue = PICK_BAN_HUES[toneKey]
    const mirrored = align === 'right'
    const direction = mirrored ? 'to left' : 'to right'

    return (
        <section aria-label={team?.name ?? 'Team to be decided'} className="relative min-w-0 flex-1">
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
                animate={{ opacity: lit ? 1 : 0 }}
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
                    {team?.ab && (
                        <span className={cn('inline-flex size-7 items-center justify-center rounded-md text-lg font-black italic', tone.solid, tone.onSolid)}>
                            {team.ab}
                        </span>
                    )}
                    {team?.stageSeed != null && (
                        <span className="text-lg font-bold uppercase tracking-[0.2em] text-white/70">Seed {team.stageSeed}</span>
                    )}
                    {chips}
                </div>
                <h2
                    className="max-w-full truncate font-black italic uppercase leading-[0.9] tracking-tight text-white [text-shadow:0_4px_24px_rgba(0,0,0,0.45)]"
                    style={{ fontSize: plateNameSize(team?.name ?? '') }}
                >
                    {team?.name ?? 'TBD'}
                </h2>
                {team && (
                    <ul className={cn('flex min-w-0 max-w-full items-center gap-6 font-sans [zoom:1.3]', mirrored && 'flex-row-reverse')}>
                        {team.members.map(member => (
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
