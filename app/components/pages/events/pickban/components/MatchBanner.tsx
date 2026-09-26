import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { toActiveTitle, type PickBanMember } from '@/app/utils/api'
import { matchSubtitle } from '../pickBanCopy'
import { statusOfPhase } from '../pickBanStatus'
import type { PickBanTeamPanel, PickBanView } from '../pickBanView'
import { PickBanStatusChip } from './PickBanStatusChip'
import { PICK_BAN_HUES, PICK_BAN_TONES, teamTone, tint } from './pickBanTone'
import { CHIP_MOTION } from './stageMotion'

type PlateAlign = 'left' | 'right'

const PLATE_EDGE: Record<PlateAlign, string> = {
    left: '@3xl/banner:[clip-path:polygon(0_0,100%_0,calc(100%_-_2.5rem)_100%,0_100%)]',
    right: '@3xl/banner:[clip-path:polygon(0_0,100%_0,100%_100%,2.5rem_100%)]',
}

const CHIP = 'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-pickban text-sm font-black italic uppercase leading-none tracking-wider'

export function MatchBanner({ view }: { view: PickBanView }) {
    const lobby = view.stagePhase === 'lobby'

    return (
        <header className="@container/banner overflow-hidden rounded-2xl border border-hairline/10 bg-card/40">
            <h1 className="sr-only">{view.match.title}</h1>
            <div className="grid grid-cols-2 @3xl/banner:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <TeamPlate panel={view.teams.left} align="left" showReady={lobby} className="order-2 @3xl/banner:order-1" />
                <div className="order-1 col-span-2 flex flex-col items-center justify-center gap-1.5 px-4 py-2.5 text-center @3xl/banner:order-2 @3xl/banner:col-span-1 @3xl/banner:px-6">
                    <PickBanStatusChip status={statusOfPhase(view.phase)} />
                    <p aria-hidden className="hidden font-pickban text-5xl font-black italic leading-none text-foreground/90 @3xl/banner:block">VS</p>
                    <p className="text-xs text-muted-foreground">{matchSubtitle(view.match)}</p>
                </div>
                <TeamPlate panel={view.teams.right} align="right" showReady={lobby} className="order-3" />
            </div>
        </header>
    )
}

function TeamPlate({ panel, align, showReady, className }: {
    panel: PickBanTeamPanel | null
    align: PlateAlign
    showReady: boolean
    className?: string
}) {
    const toneKey = teamTone(panel?.ab ?? null)
    const tone = PICK_BAN_TONES[toneKey]
    const hue = PICK_BAN_HUES[toneKey]
    const onTurn = panel?.onTurn ?? false
    const mirrored = align === 'right'
    const direction = mirrored ? 'to left' : 'to right'

    return (
        <section aria-label={panel?.name ?? 'Team to be decided'} className={cn('relative min-w-0', className)}>
            <div
                aria-hidden
                className={cn('absolute inset-0', PLATE_EDGE[align])}
                style={{ background: `linear-gradient(${direction}, ${tint(hue, 26)}, ${tint(hue, 8)} 60%, transparent)` }}
            />
            <motion.div
                aria-hidden
                initial={false}
                animate={{ opacity: onTurn ? 1 : 0 }}
                transition={{ duration: 0.45 }}
                className={cn('absolute inset-0', PLATE_EDGE[align])}
                style={{ background: `linear-gradient(${direction}, ${tint(hue, 50)}, ${tint(hue, 18)} 60%, ${tint(hue, 4)})` }}
            />
            <div aria-hidden className={cn('absolute inset-y-0 w-1.5', mirrored ? 'right-0' : 'left-0', tone.solid)} />
            <div
                className={cn(
                    'relative flex h-full min-w-0 flex-col gap-2 px-4 py-3 @xl/banner:px-5 @xl/banner:py-4 @3xl/banner:py-5',
                    mirrored ? 'items-end text-right @3xl/banner:pl-14 @3xl/banner:pr-6' : '@3xl/banner:pl-6 @3xl/banner:pr-14',
                )}
            >
                <div className={cn('flex flex-wrap items-center gap-2', mirrored && 'flex-row-reverse')}>
                    {panel?.ab && <span className={cn(CHIP, 'px-1.5', tone.solid, tone.onSolid)}>{panel.ab}</span>}
                    {panel?.stageSeed != null && (
                        <span className="font-pickban text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">Seed {panel.stageSeed}</span>
                    )}
                    <AnimatePresence initial={false}>
                        {onTurn && (
                            <motion.span key="on-turn" {...CHIP_MOTION} className={cn(CHIP, tone.solid, tone.onSolid)}>
                                On the clock
                            </motion.span>
                        )}
                        {showReady && panel && (
                            <motion.span
                                key="ready"
                                {...CHIP_MOTION}
                                className={cn(
                                    CHIP,
                                    'border',
                                    panel.ready ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-300' : 'border-hairline/15 text-muted-foreground',
                                )}
                            >
                                {panel.ready && <Check className="size-3.5" strokeWidth={3.5} />}
                                {panel.ready ? 'Ready' : 'Not ready'}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
                <h2 className="max-w-full break-words font-pickban text-2xl font-black italic uppercase leading-[0.95] tracking-tight text-foreground @xl/banner:text-3xl @5xl/banner:text-4xl @[90rem]/banner:text-5xl">
                    {panel?.name ?? 'TBD'}
                </h2>
                {panel && (
                    <div className={cn('flex min-w-0 max-w-full flex-col gap-1.5', mirrored && 'items-end')}>
                        <ul className={cn('flex min-w-0 max-w-full flex-col gap-2 @2xl/banner:flex-row @2xl/banner:flex-wrap @2xl/banner:items-center @2xl/banner:gap-x-5', mirrored ? 'items-end @2xl/banner:flex-row-reverse' : 'items-start')}>
                            {panel.members.map(member => (
                                <TeamMember key={member.id} member={member} mirrored={mirrored} />
                            ))}
                        </ul>
                        <p className="text-[11px] text-muted-foreground">
                            {panel.onlineCount} of {panel.members.length} online
                        </p>
                    </div>
                )}
            </div>
        </section>
    )
}

function TeamMember({ member, mirrored }: { member: PickBanMember; mirrored: boolean }) {
    const role = member.acting_captain ? 'Acting Captain' : member.captain ? 'Captain' : null

    return (
        <li className={cn('flex min-w-0 max-w-full items-center gap-2', mirrored && 'flex-row-reverse')}>
            <span
                title={member.online ? 'Online' : 'Offline'}
                className={cn('size-2 shrink-0 rounded-full', member.online ? 'bg-emerald-400' : 'bg-hairline/25')}
            >
                <span className="sr-only">{member.online ? 'Online' : 'Offline'}</span>
            </span>
            <PlayerInfo
                userId={member.id}
                alias={member.display_name}
                title={toActiveTitle(member.title)}
                size="md"
                className={cn('min-w-0', mirrored && 'flex-row-reverse text-right')}
            />
            {role && (
                <span
                    title={role}
                    className="shrink-0 rounded border border-hairline/15 bg-hairline/5 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-muted-foreground"
                >
                    <span aria-hidden>{member.acting_captain ? 'Acting' : 'C'}</span>
                    <span className="sr-only">{role}</span>
                </span>
            )}
        </li>
    )
}
