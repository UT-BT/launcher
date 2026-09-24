import { useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, CalendarClock, Check, CircleSlash, Pause, Trophy, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { displayMapName } from '@/app/utils/format'
import {
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
import { CountdownBar, CountdownText } from './Countdown'
import { FinalSummary } from './FinalSummary'
import { PICK_BAN_TONES, stepTone, teamTone } from './pickBanTone'
import { FADE_MOTION, SCENE_VARIANTS, choreography } from './stageMotion'

interface CentreStageProps {
    view: PickBanView
    summaryAction?: ReactNode
    className?: string
}

const TURN_SQUARE = 'w-32 @md/stage:w-44 @[80rem]/stage:w-72 max-w-[calc(100cqh-10rem)]'

const REVEAL_WIDTH = 'w-36 @md/stage:w-48 @3xl/stage:w-60 @[80rem]/stage:w-96 max-w-[calc(100cqh-7.5rem)]'

const DISCARDED = 'Its bans and picks don’t count.'

const DEFAULT_REVEAL_ENTRANCE_MS = 1_200

const DEFAULT_INTRO_ENTRANCE_MS = 900

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
            return `${view.match.title}. Starting.`
        case 'awaiting':
            return view.turn ? `${view.turn.actionLabel}.` : ''
        case 'spotlight':
            return view.spotlight?.map ? `${revealByline(view.spotlight)}: ${displayMapName(view.spotlight.map)}.` : ''
        case 'complete':
            return 'Pick/ban complete.'
        default:
            return ''
    }
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
            <AnimatePresence mode="wait" initial={false} custom={direction}>
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

function IntroName({ panel }: { panel: PickBanTeamPanel | null }) {
    const tone = PICK_BAN_TONES[teamTone(panel?.ab ?? null)]
    return (
        <span className={cn('line-clamp-2 break-words text-center text-2xl font-extrabold leading-tight @2xl/stage:text-4xl @[80rem]/stage:text-6xl', tone.text)}>
            {panel?.name ?? 'TBD'}
        </span>
    )
}

export function IntroCard({ left, right, countdown, entranceMs = DEFAULT_INTRO_ENTRANCE_MS }: {
    left: PickBanTeamPanel | null
    right: PickBanTeamPanel | null
    countdown: PickBanCountdown | null
    entranceMs?: number
}) {
    const motionOf = useMemo(() => choreography(entranceMs), [entranceMs])

    return (
        <div className="flex w-full flex-col items-center gap-3 @lg/stage:flex-row @lg/stage:justify-center @lg/stage:gap-8">
            <motion.div variants={motionOf.fromLeft} className="min-w-0 @lg/stage:flex-1 @lg/stage:text-right"><IntroName panel={left} /></motion.div>
            <motion.div variants={motionOf.centre} className="flex shrink-0 flex-col items-center gap-1.5">
                <span className="text-sm font-extrabold tracking-[0.2em] text-muted-foreground">VS</span>
                <CountdownText countdown={countdown} className="text-4xl font-bold text-foreground @[80rem]/stage:text-6xl" />
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Starting</span>
                <CountdownBar countdown={countdown} tone="neutral" className="w-28" />
            </motion.div>
            <motion.div variants={motionOf.fromRight} className="min-w-0 @lg/stage:flex-1"><IntroName panel={right} /></motion.div>
        </div>
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
                        {turn.lockedIn ? 'Locked in, revealing now' : `Waiting for ${who} to lock in`}
                    </p>
                </div>
            )}
        </div>
    )
}

function revealByline(entry: PickBanTimelineEntry): string {
    if (entry.action === 'pick') return `${entry.actionLabel} map ${entry.mapNumber}`
    if (entry.segment === 'ban_down') return `Ban-down · ${entry.actionLabel}`
    return entry.actionLabel
}

export function RevealCard({ entry, countdown, upNext, entranceMs = DEFAULT_REVEAL_ENTRANCE_MS }: {
    entry: PickBanTimelineEntry
    countdown: PickBanCountdown | null
    upNext: PickBanTurn | null
    entranceMs?: number
}) {
    const tone = PICK_BAN_TONES[stepTone(entry.actor)]
    const banned = entry.action === 'ban'
    const decider = entry.action === 'decider'
    const motionOf = useMemo(() => choreography(entranceMs), [entranceMs])

    return (
        <div className="flex w-full flex-col items-center gap-2.5 text-center @md/stage:gap-3">
            <motion.div variants={decider ? motionOf.goldFrame : motionOf.frame} className={cn('relative', REVEAL_WIDTH)}>
                {decider && (
                    <motion.div
                        aria-hidden
                        variants={motionOf.glow}
                        className="pointer-events-none absolute inset-0 rounded-2xl shadow-[0_0_60px_var(--color-pickban-gold)]"
                    />
                )}
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
                            className="absolute inset-0 bg-gradient-to-br from-pickban-gold/25 via-pickban-gold/5 to-transparent"
                        />
                    )}
                    {banned && (
                        <motion.span variants={motionOf.stamp} className="relative">
                            <span className={cn('block -rotate-8 rounded-md border-[3px] bg-black/40 px-3 py-1 text-xl font-black tracking-[0.15em] @md/stage:text-2xl', tone.text, tone.border)}>
                                BANNED
                            </span>
                        </motion.span>
                    )}
                    {decider && (
                        <motion.span variants={motionOf.badge} className={cn('absolute top-2 rounded-full px-3 py-0.5 text-xs font-extrabold tracking-[0.15em]', tone.solid, tone.onSolid)}>
                            DECIDER
                        </motion.span>
                    )}
                    {entry.action === 'pick' && (
                        <motion.span variants={motionOf.badge} className={cn('absolute top-2 rounded-full px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider', tone.solid, tone.onSolid)}>
                            Map {entry.mapNumber}
                        </motion.span>
                    )}
                </div>
            </motion.div>
            <motion.div variants={motionOf.caption} className="min-w-0 max-w-full space-y-0.5">
                <p className="truncate text-lg font-extrabold text-foreground @[80rem]/stage:text-3xl">{entry.map ? displayMapName(entry.map) : ''}</p>
                <p className={cn('text-[11px] font-bold uppercase tracking-wider', tone.text)}>
                    {decider ? 'Decider · last map standing' : revealByline(entry)}
                    {entry.actedByAdmin && <span className="text-muted-foreground"> · set by an admin</span>}
                </p>
            </motion.div>
            <motion.div variants={motionOf.caption} className={REVEAL_WIDTH}>
                <CountdownBar countdown={countdown} tone={decider ? 'gold' : stepTone(entry.actor)} />
            </motion.div>
            <motion.p variants={motionOf.caption} className={cn('text-xs text-muted-foreground', !upNext && 'invisible')}>
                Up next: {upNext?.actionLabel ?? ''}
            </motion.p>
        </div>
    )
}

function PausedOverlay() {
    return (
        <motion.div {...FADE_MOTION} className="absolute inset-0 z-10 flex items-center justify-center bg-background/75 backdrop-blur-[6px]">
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
