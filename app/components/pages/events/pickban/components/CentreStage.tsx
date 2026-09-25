import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { Ban, CalendarClock, Check, CircleSlash, Pause, Trophy, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import {
    INTRO_ENTRANCE_MAX_MS,
    REVEAL_ENTRANCE_MAX_MS,
    playsEntrance,
    sceneDirection,
    type PickBanBanner,
    type PickBanCardView,
    type PickBanCountdown,
    type PickBanScene,
    type PickBanSceneDirection,
    type PickBanTeamPanel,
    type PickBanTimelineEntry,
    type PickBanTurn,
    type PickBanView,
} from '../pickBanView'
import { CountdownBar, IntroCountdownWords } from './Countdown'
import { FinalSummary } from './FinalSummary'
import { Aura, ConfettiBurst, Flash, Rays, Ribbon, Shockwave, SparkBurst, Strike } from './RevealEffects'
import { PICK_BAN_HUES, PICK_BAN_TONES, stepTone, teamTone } from './pickBanTone'
import { FADE_MOTION, SCENE_VARIANTS, choreography, type Choreography } from './stageMotion'

interface CentreStageProps {
    view: PickBanView
    summaryAction?: ReactNode
    className?: string
}

const TURN_SQUARE = 'w-32 @md/stage:w-44 @[80rem]/stage:w-72 max-w-[calc(100cqh-10rem)]'

const REVEAL_WIDTH = 'w-36 @md/stage:w-48 @3xl/stage:w-60 @[80rem]/stage:w-96 max-w-[calc(100cqh-7.5rem)]'

const DISCARDED = 'Its bans and picks don’t count.'

const DECIDER_LETTERS = [...'DECIDER']

type RevealKind = 'pick' | 'ban' | 'ban_down' | 'decider'

function useSceneDirection(scene: PickBanScene): PickBanSceneDirection {
    const [shown, setShown] = useState<{ scene: PickBanScene; direction: PickBanSceneDirection }>({ scene, direction: 0 })
    if (shown.scene.key === scene.key) return shown.direction
    const next = { scene, direction: sceneDirection(shown.scene, scene) }
    setShown(next)
    return next.direction
}

function stageAnnouncement(view: PickBanView): string {
    switch (view.stagePhase) {
        case 'intro':
            return `${view.match.title}. Picks and bans are about to start.`
        case 'awaiting':
            return view.turn ? `${view.turn.actionLabel}.` : ''
        case 'spotlight':
            return view.spotlight?.map ? `${revealAnnouncement(view.spotlight)}: ${displayMapName(view.spotlight.map)}.` : ''
        case 'complete':
            return 'Pick/ban complete.'
        default:
            return ''
    }
}

function revealAnnouncement(entry: PickBanTimelineEntry): string {
    if (!entry.automatic || entry.action === 'decider') return revealByline(entry)
    const mapNumber = entry.action === 'pick' ? ` map ${entry.mapNumber}` : ''
    return `${entry.actionLabel}${mapNumber}, locked automatically as the last map standing`
}

export function CentreStage({ view, summaryAction, className }: CentreStageProps) {
    const paused = view.banners.some(banner => banner.kind === 'paused')
    const onTheClock = view.stagePhase === 'awaiting' && view.turn ? PICK_BAN_TONES[stepTone(view.turn.ab)] : null
    const direction = useSceneDirection(view.scene)

    return (
        <section
            aria-label="Pick/ban stage"
            className={cn(
                '@container-size/stage relative flex items-center justify-center overflow-hidden rounded-xl border border-hairline/10 bg-card/30 p-4',
                onTheClock && cn('bg-gradient-to-b to-transparent', onTheClock.wash),
                className,
            )}
        >
            <p aria-live="polite" className="sr-only">{paused ? 'Paused.' : stageAnnouncement(view)}</p>
            <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                <motion.div
                    key={view.scene.key}
                    custom={direction}
                    variants={SCENE_VARIANTS}
                    initial={playsEntrance(view.scene, direction) ? 'hidden' : false}
                    animate="shown"
                    exit="gone"
                    className="flex w-full items-center justify-center"
                >
                    <StageContent view={view} summaryAction={summaryAction} />
                </motion.div>
            </AnimatePresence>
            <AnimatePresence>
                {paused && <PausedOverlay key="paused" />}
            </AnimatePresence>
        </section>
    )
}

function StageContent({ view, summaryAction }: { view: PickBanView; summaryAction?: ReactNode }) {
    switch (view.stagePhase) {
        case 'none':
            return (
                <StageNotice
                    icon={CalendarClock}
                    title="Not open yet"
                    detail="The lobby opens on match day. The teams, maps and steps here are a preview."
                />
            )
        case 'lobby':
            return <LobbyCard left={view.teams.left} right={view.teams.right} />
        case 'intro':
            return <IntroCard left={view.teams.left} right={view.teams.right} countdown={view.countdown} entranceMs={view.scene.entranceMs} />
        case 'spotlight':
            if (view.spotlight) {
                return <RevealCard entry={view.spotlight} countdown={view.countdown} upNext={view.turn} entranceMs={view.scene.entranceMs} />
            }
            return null
        case 'awaiting':
            if (!view.turn) return null
            return (
                <TurnCard
                    turn={view.turn}
                    previewCard={view.cards.find(card => card.previewed) ?? null}
                    stepCount={view.timeline.length}
                    mapCount={view.summary.length}
                />
            )
        case 'complete':
            return (
                <div className="flex w-full flex-col items-center gap-3 @md/stage:gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        <Trophy className="size-4 text-pickban-gold" />
                        Maps in play order
                        {view.edited && (
                            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[10px] text-amber-300">Edited</span>
                        )}
                    </div>
                    <FinalSummary entries={view.summary} />
                    {summaryAction}
                </div>
            )
        case 'cancelled':
            return <StageNotice icon={Ban} title="Pick/ban cancelled" reason={endReasonOf(view.banners)} detail={DISCARDED} />
        case 'voided':
            return (
                <StageNotice
                    icon={CircleSlash}
                    title="Pick/ban voided"
                    reason={endReasonOf(view.banners) ?? 'The match changed after this session opened.'}
                    detail={DISCARDED}
                />
            )
    }
}

function endReasonOf(banners: PickBanBanner[]): string | null {
    for (const banner of banners) {
        if (banner.kind === 'voided' || banner.kind === 'cancelled') return banner.reason
    }
    return null
}

function StageNotice({ icon: Icon, title, reason = null, detail }: {
    icon: LucideIcon
    title: string
    reason?: string | null
    detail: string
}) {
    return (
        <div className="flex max-w-sm flex-col items-center gap-2 text-center">
            <Icon className="size-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {reason && <p title={reason} className="line-clamp-3 break-words text-sm text-foreground">{reason}</p>}
            <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
    )
}

function ReadyRow({ panel }: { panel: PickBanTeamPanel | null }) {
    const tone = PICK_BAN_TONES[teamTone(panel?.ab ?? null)]
    const ready = panel?.ready ?? null

    return (
        <li className="flex items-center justify-between gap-3 rounded-lg border border-hairline/10 bg-card/60 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-full', tone.solid)} />
                <span className="truncate text-sm font-semibold text-foreground">{panel?.name ?? 'TBD'}</span>
            </span>
            <span
                className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    ready ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' : 'border-hairline/10 bg-hairline/5 text-muted-foreground',
                )}
            >
                {ready ? 'Ready' : 'Not ready'}
            </span>
        </li>
    )
}

function LobbyCard({ left, right }: { left: PickBanTeamPanel | null; right: PickBanTeamPanel | null }) {
    return (
        <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Lobby open</p>
            <h2 className="text-lg font-semibold text-foreground @md/stage:text-xl">Waiting for an admin to start</h2>
            <ul className="flex w-full flex-col gap-2 text-left">
                <ReadyRow panel={left} />
                <ReadyRow panel={right} />
            </ul>
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
                    'relative line-clamp-2 break-words text-center text-3xl font-black italic leading-[1.05] tracking-tight @2xl/stage:text-5xl @[80rem]/stage:text-7xl',
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
                    className="relative text-xl font-black italic tracking-wider text-foreground @2xl/stage:text-3xl @[80rem]/stage:text-5xl"
                >
                    vs
                </motion.span>
            </div>
            <IntroName panel={right} variants={motionOf.fromRight} streak={motionOf.streakRight} streakOrigin="origin-right" />
            <motion.div variants={motionOf.countdown} className="mt-2 flex flex-col items-center gap-2 @[80rem]/stage:mt-6 @[80rem]/stage:gap-3">
                <IntroCountdownWords
                    countdown={countdown}
                    className="text-sm font-semibold text-muted-foreground @2xl/stage:text-base @[80rem]/stage:text-2xl"
                />
                <CountdownBar countdown={countdown} tone="neutral" className="w-40 @[80rem]/stage:h-1.5 @[80rem]/stage:w-96" />
            </motion.div>
        </motion.div>
    )
}

export function TurnCard({ turn, previewCard, stepCount, mapCount }: {
    turn: PickBanTurn
    previewCard: PickBanCardView | null
    stepCount: number
    mapCount: number
}) {
    const tone = PICK_BAN_TONES[stepTone(turn.ab)]
    const Icon = turn.action === 'ban' ? Ban : Check
    const who = turn.actorLabel

    return (
        <div className="flex w-full flex-col items-center gap-3 text-center @md/stage:gap-4">
            <div className={cn('inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-1.5', tone.soft, tone.line)}>
                <Icon className={cn('size-5 shrink-0', tone.text)} strokeWidth={2.5} />
                <span className="truncate text-base font-bold text-foreground @md/stage:text-xl @[80rem]/stage:text-3xl">{who}</span>
                <span className={cn('shrink-0 rounded px-2 py-0.5 text-xs font-black uppercase tracking-widest @md/stage:text-sm @[80rem]/stage:text-xl', tone.solid, tone.onSolid)}>
                    {turn.action === 'ban' ? 'Ban' : 'Pick'}
                </span>
            </div>
            <p className="text-xs text-muted-foreground">
                Step {turn.stepNumber} of {stepCount}
                {turn.mapNumber !== null && ` · Map ${turn.mapNumber} of ${mapCount}`}
            </p>
            {previewCard ? (
                <div className="flex flex-col items-center gap-2">
                    <div className={cn('relative aspect-square overflow-hidden rounded-xl border-2 ring-4', TURN_SQUARE, tone.border, tone.ring)}>
                        <MapThumbnail
                            mapName={previewCard.map}
                            version={previewCard.screenshotVersion}
                            size="card"
                            alt=""
                            className="absolute inset-0 h-full w-full rounded-none border-0"
                        />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{displayMapName(previewCard.map)}</p>
                    <p className={cn('text-[11px] font-bold uppercase tracking-wider', tone.text)}>{who} is considering this map</p>
                </div>
            ) : (
                <div className={cn('flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed', TURN_SQUARE, tone.line)}>
                    <Icon className={cn('size-8 opacity-60', tone.text)} />
                    <p className="px-3 text-xs text-muted-foreground">
                        {turn.lockedIn ? 'Locked in, revealing now' : turn.viewerActs ? 'Your turn: select a map, then lock in' : `Waiting for ${who} to lock in`}
                    </p>
                </div>
            )}
        </div>
    )
}

function revealByline(entry: PickBanTimelineEntry): string {
    if (entry.automatic && entry.action !== 'decider') return 'Last map standing · locked automatically'
    if (entry.action === 'pick') return `${entry.actionLabel} map ${entry.mapNumber}`
    if (entry.segment === 'ban_down') return `Ban-down · ${entry.actionLabel}`
    return entry.actionLabel
}

function revealKindOf(entry: PickBanTimelineEntry): RevealKind {
    if (entry.action === 'decider') return 'decider'
    if (entry.action === 'pick') return 'pick'
    return entry.segment === 'ban_down' ? 'ban_down' : 'ban'
}

function shakeOf(motionOf: Choreography, kind: RevealKind): Variants {
    if (kind === 'decider') return motionOf.shakeOnDecider
    if (kind === 'pick') return motionOf.shakeOnImpact
    return motionOf.shakeOnStamp
}

function frameOf(motionOf: Choreography, kind: RevealKind): Variants {
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
                                        'block -rotate-8 rounded-md border-[3px] bg-black/50 px-2.5 py-1 text-lg font-black tracking-[0.15em] @md/stage:px-3 @md/stage:text-2xl @[80rem]/stage:border-4 @[80rem]/stage:px-5 @[80rem]/stage:text-4xl',
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
                                    'absolute top-2 rounded-full px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider @[80rem]/stage:top-4 @[80rem]/stage:px-4 @[80rem]/stage:text-base',
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
                <p className="truncate text-lg font-extrabold text-foreground @[80rem]/stage:text-3xl">{entry.map ? displayMapName(entry.map) : ''}</p>
                <p className={cn('text-[11px] font-bold uppercase tracking-wider @[80rem]/stage:text-sm', tone.text)}>
                    {decider ? 'Decider · last map standing' : revealByline(entry)}
                    {entry.actedByAdmin && <span className="text-muted-foreground"> · set by an admin</span>}
                </p>
            </motion.div>
            <motion.div variants={caption} className={REVEAL_WIDTH}>
                <CountdownBar countdown={countdown} tone={toneKey} />
            </motion.div>
            <motion.p variants={caption} className={cn('text-xs text-muted-foreground @[80rem]/stage:text-sm', !upNext && 'invisible')}>
                Up next: {upNext?.actionLabel ?? ''}
            </motion.p>
        </motion.div>
    )
}

function PausedOverlay() {
    return (
        <motion.div data-stage-part="paused" {...FADE_MOTION} className="absolute inset-0 z-10 flex items-center justify-center bg-background/75 backdrop-blur-[6px]">
            <div className="flex items-center gap-3 rounded-2xl border border-hairline/10 bg-card px-5 py-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent-500/15 text-accent-200">
                    <Pause className="size-4" />
                </span>
                <div>
                    <p className="text-sm font-extrabold uppercase tracking-wider text-foreground">Session paused</p>
                    <p className="text-xs text-muted-foreground">Waiting for an admin to resume</p>
                </div>
            </div>
        </motion.div>
    )
}
