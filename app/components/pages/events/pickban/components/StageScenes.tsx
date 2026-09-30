import { useMemo, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { Pause, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import {
    INTRO_ENTRANCE_MAX_MS,
    REVEAL_ENTRANCE_MAX_MS,
    actionTagOf,
    sceneDirection,
    type PickBanBanner,
    type PickBanCountdown,
    type PickBanScene,
    type PickBanSceneDirection,
    type PickBanTeamPanel,
    type PickBanTimelineEntry,
    type PickBanTurn,
    type PickBanView,
} from '../pickBanView'
import { CountdownBar, IntroCountdownWords } from './Countdown'
import { Aura, ConfettiBurst, Flash, Rays, Ribbon, Shockwave, SparkBurst, Strike } from './RevealEffects'
import { PICK_BAN_HUES, PICK_BAN_TONES, stepTone, teamTone } from './pickBanTone'
import { FADE_MOTION, choreography, type Choreography } from './stageMotion'

const REVEAL_WIDTH = 'w-36 @md/stage:w-48 @3xl/stage:w-60 @[80rem]/stage:w-96 max-w-[calc(100cqh-10.5rem)]'

export const DISCARDED = 'Its picks and bans don’t count.'

export const DECIDER_LETTERS = [...'DECIDER']

const DECIDER_BYLINE = 'Left by both teams'

export type RevealKind = 'pick' | 'ban' | 'ban_down' | 'decider'

export function useSceneDirection(scene: PickBanScene): PickBanSceneDirection {
    const [shown, setShown] = useState<{ scene: PickBanScene; direction: PickBanSceneDirection }>({ scene, direction: 0 })
    if (shown.scene.key === scene.key) return shown.direction
    const next = { scene, direction: sceneDirection(shown.scene, scene) }
    setShown(next)
    return next.direction
}

export function stageAnnouncement(view: PickBanView): string {
    switch (view.stagePhase) {
        case 'intro':
            return `${view.match.title}. Picks & Bans are about to start.`
        case 'awaiting':
            return view.turn ? `${actionTagOf(view.turn)}.` : ''
        case 'spotlight':
            return view.spotlight?.map ? `${revealAnnouncement(view.spotlight)}: ${displayMapName(view.spotlight.map)}.` : ''
        case 'complete':
            return 'Picks & Bans complete.'
        default:
            return ''
    }
}

function revealAnnouncement(entry: PickBanTimelineEntry): string {
    if (entry.action === 'decider') return `Decider, ${DECIDER_BYLINE.toLowerCase()}`
    if (!entry.automatic) return revealByline(entry)
    const mapNumber = entry.action === 'pick' ? ` map ${entry.mapNumber}` : ''
    return `${entry.actionLabel}${mapNumber}, locked automatically as the last map standing`
}

export function endReasonOf(banners: PickBanBanner[]): string | null {
    for (const banner of banners) {
        if (banner.kind === 'voided' || banner.kind === 'cancelled') return banner.reason
    }
    return null
}

export function StageNotice({ icon: Icon, title, reason = null, detail }: {
    icon: LucideIcon
    title: string
    reason?: string | null
    detail: string
}) {
    return (
        <div className="flex max-w-sm flex-col items-center gap-2 text-center">
            <Icon className="size-8 text-muted-foreground" />
            <h2 className="font-pickban text-2xl font-black italic uppercase leading-none text-foreground">{title}</h2>
            {reason && <p title={reason} className="line-clamp-3 break-words text-sm text-foreground">{reason}</p>}
            <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
    )
}

function IntroName({ panel, variants, streak, streakOrigin }: {
    panel: PickBanTeamPanel | null
    variants: Variants
    streak: Variants
    streakOrigin: 'origin-left' | 'origin-right'
}) {
    const tone = teamTone(panel?.ab ?? null)
    const hue = PICK_BAN_HUES[tone]
    return (
        <motion.div variants={variants} className="relative flex w-full justify-center px-2">
            <motion.span
                aria-hidden
                variants={streak}
                className={cn('pointer-events-none absolute inset-y-[12%] inset-x-0 -skew-x-12', streakOrigin)}
                style={{ background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${hue} 30%, transparent) 50%, transparent)` }}
            />
            <span
                className={cn(
                    'relative line-clamp-2 break-words text-center font-pickban text-4xl font-black italic uppercase leading-[0.95] tracking-tight @2xl/stage:text-6xl @[80rem]/stage:text-8xl',
                    PICK_BAN_TONES[tone].text,
                )}
            >
                {panel?.name ?? 'TBD'}
            </span>
        </motion.div>
    )
}

export function IntroCard({ left, right, countdown, entranceMs = INTRO_ENTRANCE_MAX_MS }: {
    left: PickBanTeamPanel | null
    right: PickBanTeamPanel | null
    countdown: PickBanCountdown | null
    entranceMs?: number
}) {
    const motionOf = useMemo(() => choreography(entranceMs), [entranceMs])

    return (
        <motion.div variants={motionOf.shakeOnVs} className="flex w-full flex-col items-center gap-1 text-center @md/stage:gap-2 @[80rem]/stage:gap-4">
            <IntroName panel={left} variants={motionOf.fromLeft} streak={motionOf.streakLeft} streakOrigin="origin-left" />
            <div className="relative flex items-center justify-center">
                <motion.span
                    aria-hidden
                    variants={motionOf.vsShockwave}
                    className="pointer-events-none absolute size-12 rounded-full border-2 border-foreground/70 @[80rem]/stage:size-24"
                />
                <motion.span
                    variants={motionOf.vs}
                    className="relative font-pickban text-2xl font-black italic uppercase tracking-wider text-foreground @2xl/stage:text-4xl @[80rem]/stage:text-6xl"
                >
                    vs
                </motion.span>
            </div>
            <IntroName panel={right} variants={motionOf.fromRight} streak={motionOf.streakRight} streakOrigin="origin-right" />
            <motion.div variants={motionOf.countdown} className="mt-2 flex flex-col items-center gap-2 @[80rem]/stage:mt-6 @[80rem]/stage:gap-3">
                <IntroCountdownWords
                    countdown={countdown}
                    className="font-pickban text-base font-black italic uppercase tracking-wide text-muted-foreground @2xl/stage:text-xl @[80rem]/stage:text-3xl"
                />
                <CountdownBar countdown={countdown} tone="neutral" className="w-40 @[80rem]/stage:h-1.5 @[80rem]/stage:w-96" />
            </motion.div>
        </motion.div>
    )
}

export function nextStepLabel(turn: PickBanTurn): string {
    return turn.action === 'decider' ? 'Decider' : `${turn.actorLabel} to ${turn.action}`
}

export function revealByline(entry: PickBanTimelineEntry): string {
    if (entry.action === 'decider') return DECIDER_BYLINE
    if (entry.automatic) return 'Last map standing · locked automatically'
    return `${entry.action === 'pick' ? 'Picked' : 'Banned'} by ${entry.actorLabel}`
}

export function revealKindOf(entry: PickBanTimelineEntry): RevealKind {
    if (entry.action === 'decider') return 'decider'
    if (entry.action === 'pick') return 'pick'
    return entry.segment === 'ban_down' ? 'ban_down' : 'ban'
}

export function shakeOf(motionOf: Choreography, kind: RevealKind): Variants {
    if (kind === 'decider') return motionOf.shakeOnDecider
    if (kind === 'pick') return motionOf.shakeOnImpact
    return motionOf.shakeOnStamp
}

export function frameOf(motionOf: Choreography, kind: RevealKind): Variants {
    if (kind === 'decider') return motionOf.goldFrame
    if (kind === 'pick') return motionOf.pickFrame
    return motionOf.banFrame
}

export function RevealCard({ entry, countdown, upNext, entranceMs = REVEAL_ENTRANCE_MAX_MS.lettered }: {
    entry: PickBanTimelineEntry
    countdown: PickBanCountdown | null
    upNext: PickBanTurn | null
    entranceMs?: number
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
        <motion.div variants={shakeOf(motionOf, kind)} className="flex w-full flex-col items-center gap-2.5 text-center @md/stage:gap-3">
            <div className={cn('relative', REVEAL_WIDTH)}>
                {decider && <Rays variants={motionOf.rays} turn={motionOf.raysTurn} />}
                {kind !== 'ban_down' && <Aura variants={decider ? motionOf.glow : motionOf.aura} hue={hue} />}
                {!banned && <Shockwave variants={decider ? motionOf.deciderShockwave : motionOf.shockwave} hue={hue} />}
                <motion.div data-stage-part="reveal" variants={frameOf(motionOf, kind)} className="relative">
                    <div
                        className={cn(
                            'relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border-[3px]',
                            tone.border,
                            decider && cn('ring-4', tone.ring),
                        )}
                    >
                        {entry.map && (
                            <motion.div variants={banned ? motionOf.desaturate : undefined} className="absolute inset-0">
                                <MapThumbnail
                                    mapName={entry.map}
                                    version={entry.screenshotVersion}
                                    size="card"
                                    alt=""
                                    priority
                                    className="absolute inset-0 h-full w-full rounded-none border-0"
                                />
                            </motion.div>
                        )}
                        {decider && (
                            <motion.div
                                aria-hidden
                                variants={motionOf.sheen}
                                className="absolute inset-0 bg-gradient-to-br from-pickban-gold/30 via-pickban-gold/5 to-transparent"
                            />
                        )}
                        {banned && <Flash variants={motionOf.teamFlash} color={hue} />}
                        {banned && <Strike slash={motionOf.slash} crack={motionOf.crack} hue={hue} cracks={kind === 'ban'} />}
                        {kind === 'pick' && <Flash variants={motionOf.teamFlash} className="bg-white/60" />}
                        {decider && <Flash variants={motionOf.goldFlash} className="bg-gradient-to-b from-white via-pickban-gold/80 to-pickban-gold/40" />}
                        {banned && (
                            <motion.span variants={motionOf.stamp} className="relative">
                                <span
                                    className={cn(
                                        'block -rotate-8 rounded-md border-[3px] bg-black/50 px-2.5 py-1 font-pickban text-xl font-black italic tracking-[0.12em] @md/stage:px-3 @md/stage:text-3xl @[80rem]/stage:border-4 @[80rem]/stage:px-5 @[80rem]/stage:text-5xl',
                                        tone.text,
                                        tone.border,
                                    )}
                                >
                                    BANNED
                                </span>
                            </motion.span>
                        )}
                        {!banned && entry.mapNumber !== null && (
                            <motion.span
                                variants={decider ? motionOf.deciderBadge : motionOf.badge}
                                className={cn(
                                    'absolute top-2 rounded-lg px-3 py-0.5 font-pickban text-base font-black italic uppercase @[80rem]/stage:top-4 @[80rem]/stage:px-4 @[80rem]/stage:text-2xl',
                                    tone.solid,
                                    tone.onSolid,
                                )}
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
            <motion.div variants={caption} className="min-w-0 max-w-full space-y-0.5">
                <p className="truncate font-pickban text-2xl font-black italic uppercase leading-none tracking-tight text-foreground @[80rem]/stage:text-5xl">{entry.map ? displayMapName(entry.map) : ''}</p>
                <p className={cn('font-pickban text-sm font-bold uppercase tracking-[0.16em] @[80rem]/stage:text-xl', tone.text)}>
                    {revealByline(entry)}
                    {entry.actedByAdmin && <span className="text-muted-foreground"> · set by an admin</span>}
                </p>
            </motion.div>
            <motion.div variants={caption} className={REVEAL_WIDTH}>
                <CountdownBar countdown={countdown} tone={toneKey} />
            </motion.div>
            <motion.p variants={caption} className={cn('font-pickban text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground @[80rem]/stage:text-lg', !upNext && 'invisible')}>
                Next: {upNext ? nextStepLabel(upNext) : ''}
            </motion.p>
        </motion.div>
    )
}

export function PausedOverlay() {
    return (
        <motion.div data-stage-part="paused" {...FADE_MOTION} className="absolute inset-0 z-10 flex items-center justify-center bg-background/75 backdrop-blur-[6px]">
            <div className="flex items-center gap-3 rounded-2xl border border-hairline/10 bg-card px-5 py-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent-500/15 text-accent-200">
                    <Pause className="size-4" />
                </span>
                <div>
                    <p className="font-pickban text-xl font-black italic uppercase tracking-wide text-foreground">Session paused</p>
                    <p className="text-xs text-muted-foreground">Waiting for an admin to resume</p>
                </div>
            </div>
        </motion.div>
    )
}
