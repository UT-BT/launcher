import { useMemo } from 'react'
import { motion, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { displayMapName } from '@/app/utils/format'
import { toActiveTitle } from '@/app/utils/api'
import { type PickBanCountdown, type PickBanTeamPanel, type PickBanTimelineEntry, type PickBanTurn } from '../pickBanView'
import { CountdownBar, IntroCountdownWords } from '../components/Countdown'
import { DECIDER_LETTERS, frameOf, nextStepLabel, revealByline, revealKindOf, shakeOf } from '../components/StageScenes'
import { Aura, ConfettiBurst, Flash, Rays, Ribbon, Shockwave, SparkBurst, Strike } from '../components/RevealEffects'
import { PICK_BAN_HUES, PICK_BAN_TONES, stepTone, teamTone, tint } from '../components/pickBanTone'
import { choreography } from '../components/stageMotion'

export function BroadcastIntro({ left, right, countdown, entranceMs }: {
    left: PickBanTeamPanel | null
    right: PickBanTeamPanel | null
    countdown: PickBanCountdown | null
    entranceMs: number
}) {
    const motionOf = useMemo(() => choreography(entranceMs), [entranceMs])

    return (
        <motion.div variants={motionOf.shakeOnVs} className="flex w-full flex-col items-center gap-14">
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-10 px-16">
                <IntroTeam panel={left} align="left" variants={motionOf.fromLeft} streak={motionOf.streakLeft} />
                <div className="relative flex items-center justify-center">
                    <motion.span
                        aria-hidden
                        variants={motionOf.vsShockwave}
                        className="pointer-events-none absolute size-40 rounded-full border-4 border-white/80"
                    />
                    <motion.span variants={motionOf.vs} className="relative text-[112px] font-black italic leading-none text-white [text-shadow:0_6px_30px_rgba(0,0,0,0.6)]">
                        VS
                    </motion.span>
                </div>
                <IntroTeam panel={right} align="right" variants={motionOf.fromRight} streak={motionOf.streakRight} />
            </div>
            <motion.div variants={motionOf.countdown} className="flex flex-col items-center gap-4">
                <IntroCountdownWords countdown={countdown} className="text-[40px] font-black italic uppercase leading-none tracking-wide text-white/85" />
                <CountdownBar countdown={countdown} tone="neutral" className="h-2 w-[560px] bg-white/10" />
            </motion.div>
        </motion.div>
    )
}

function IntroTeam({ panel, align, variants, streak }: {
    panel: PickBanTeamPanel | null
    align: 'left' | 'right'
    variants: Variants
    streak: Variants
}) {
    const toneKey = teamTone(panel?.ab ?? null)
    const hue = PICK_BAN_HUES[toneKey]
    const mirrored = align === 'right'

    return (
        <motion.div variants={variants} className={cn('relative flex min-w-0 flex-col gap-6', mirrored ? 'items-start text-left' : 'items-end text-right')}>
            <motion.span
                aria-hidden
                variants={streak}
                className={cn('pointer-events-none absolute -inset-x-10 top-0 h-[128px] -skew-x-12', mirrored ? 'origin-right' : 'origin-left')}
                style={{ background: `linear-gradient(90deg, transparent, ${tint(hue, 45)} 50%, transparent)` }}
            />
            <span
                className="relative line-clamp-2 max-w-full break-words text-[112px] font-black italic uppercase leading-[0.95] tracking-tight [text-shadow:0_6px_30px_rgba(0,0,0,0.6)]"
                style={{ color: hue }}
            >
                {panel?.name ?? 'TBD'}
            </span>
            {panel && (
                <ul className={cn('relative flex items-center gap-8 font-sans [zoom:1.5]', mirrored ? 'flex-row' : 'flex-row-reverse')}>
                    {panel.members.map(member => (
                        <li key={member.id}>
                            <PlayerInfo userId={member.id} alias={member.display_name} title={toActiveTitle(member.title)} size="md" interactive={false} />
                        </li>
                    ))}
                </ul>
            )}
        </motion.div>
    )
}

export function BroadcastReveal({ entry, countdown, upNext, entranceMs }: {
    entry: PickBanTimelineEntry
    countdown: PickBanCountdown | null
    upNext: PickBanTurn | null
    entranceMs: number
}) {
    const toneKey = stepTone(entry.actor)
    const tone = PICK_BAN_TONES[toneKey]
    const hue = PICK_BAN_HUES[toneKey]
    const kind = revealKindOf(entry)
    const banned = kind === 'ban' || kind === 'ban_down'
    const decider = kind === 'decider'
    const motionOf = useMemo(() => choreography(entranceMs), [entranceMs])
    const caption = decider ? motionOf.deciderCaption : motionOf.caption

    return (
        <motion.div variants={shakeOf(motionOf, kind)} className="@container/stage flex w-full flex-col items-center gap-7 text-center">
            <div className="relative w-[440px]">
                {decider && <Rays variants={motionOf.rays} turn={motionOf.raysTurn} />}
                {kind !== 'ban_down' && <Aura variants={decider ? motionOf.glow : motionOf.aura} hue={hue} />}
                {!banned && <Shockwave variants={decider ? motionOf.deciderShockwave : motionOf.shockwave} hue={hue} />}
                <motion.div data-stage-part="reveal" variants={frameOf(motionOf, kind)} className="relative">
                    <div
                        className={cn('relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl border-[5px]', tone.border)}
                        style={{ boxShadow: `0 0 60px ${tint(hue, banned ? 25 : 50)}, 0 24px 60px rgba(0,0,0,0.6)` }}
                    >
                        {entry.map && (
                            <motion.div variants={banned ? motionOf.desaturate : undefined} className="absolute inset-0">
                                <MapThumbnail
                                    mapName={entry.map}
                                    version={entry.screenshotVersion}
                                    size="hero"
                                    alt=""
                                    priority
                                    className="absolute inset-0 size-full rounded-none border-0"
                                />
                            </motion.div>
                        )}
                        {decider && (
                            <motion.div aria-hidden variants={motionOf.sheen} className="absolute inset-0 bg-gradient-to-br from-pickban-gold/30 via-pickban-gold/5 to-transparent" />
                        )}
                        {banned && <Flash variants={motionOf.teamFlash} color={hue} />}
                        {banned && <Strike slash={motionOf.slash} crack={motionOf.crack} hue={hue} cracks={kind === 'ban'} />}
                        {kind === 'pick' && <Flash variants={motionOf.teamFlash} className="bg-white/60" />}
                        {decider && <Flash variants={motionOf.goldFlash} className="bg-gradient-to-b from-white via-pickban-gold/80 to-pickban-gold/40" />}
                        {banned && (
                            <motion.span variants={motionOf.stamp} className="relative">
                                <span className={cn('block -rotate-8 rounded-lg border-[5px] bg-black/55 px-6 py-1 text-[64px] font-black italic leading-none tracking-[0.12em]', tone.text, tone.border)}>
                                    BANNED
                                </span>
                            </motion.span>
                        )}
                        {!banned && entry.mapNumber !== null && (
                            <motion.span
                                variants={decider ? motionOf.deciderBadge : motionOf.badge}
                                className={cn('absolute top-5 rounded-xl px-5 py-1.5 text-[34px] font-black italic uppercase leading-none shadow-xl', tone.solid, tone.onSolid)}
                            >
                                Map {entry.mapNumber}
                            </motion.span>
                        )}
                    </div>
                </motion.div>
                {decider && (
                    <Ribbon strip={motionOf.deciderRibbon} hue={hue} dark>
                        <span className="sr-only">Decider</span>
                        {DECIDER_LETTERS.map((letter, index) => (
                            <motion.span key={index} aria-hidden variants={motionOf.letter(index, DECIDER_LETTERS.length)} className="inline-block px-[0.12em]">
                                {letter}
                            </motion.span>
                        ))}
                    </Ribbon>
                )}
                {kind === 'pick' && <SparkBurst sparks={motionOf.sparks} hue={hue} />}
                {decider && <ConfettiBurst confetti={motionOf.confetti} />}
            </div>
            <motion.div variants={caption} className="flex min-w-0 max-w-[1400px] flex-col items-center gap-2">
                <p className="max-w-full truncate text-[72px] font-black italic uppercase leading-none tracking-tight text-white [text-shadow:0_6px_30px_rgba(0,0,0,0.6)]">
                    {entry.map ? displayMapName(entry.map) : ''}
                </p>
                <p className={cn('text-[26px] font-bold uppercase leading-none tracking-[0.18em]', tone.text)}>
                    {revealByline(entry)}
                    {entry.actedByAdmin && <span className="text-white/50"> · set by an admin</span>}
                </p>
            </motion.div>
            <motion.div variants={caption} className="flex flex-col items-center gap-3">
                <CountdownBar countdown={countdown} tone={toneKey} className="h-2 w-[440px] bg-white/10" />
                <p className={cn('text-xl font-bold uppercase tracking-[0.2em] text-white/55', !upNext && 'invisible')}>
                    Next: {upNext ? nextStepLabel(upNext) : ''}
                </p>
            </motion.div>
        </motion.div>
    )
}
