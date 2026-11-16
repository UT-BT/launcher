import { useEffect, useMemo, useRef, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { MotionConfig, motion } from 'framer-motion'
import { ArrowRight, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModalBehaviour } from '@/app/components/ui/useModalBehaviour'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { NavLink } from '@/app/components/navigation/NavLink'
import { PICK_BAN_HUES, tint } from '@/app/components/broadcast/broadcastTone'
import { useBroadcastFonts } from '@/app/components/broadcast/broadcastFonts'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { useTheme } from '@/app/theme/ThemeProvider'
import { isLightTheme } from '@/app/theme/themes'
import type { Celebration, CelebrationMember, CelebrationPlace } from '@/app/utils/api'
import { BEATS, RAYS_TURN, aura, backdrop, confetti, panel, rays, rise, rule, shockwave, slam, sparks, stamp } from './celebrationMotion'
import './championsCelebration.css'

const GOLD = PICK_BAN_HUES.gold

const CONFETTI_TINTS = ['bg-pickban-gold', 'bg-amber-200', 'bg-white', 'bg-slate-300', 'bg-pickban-gold', 'bg-amber-500']

const MEDALS = {
    2: { label: 'Runner-up', medal: 'champions-medal-silver' },
    3: { label: 'Third place', medal: 'champions-medal-bronze' },
} as const

interface ChampionsCelebrationProps {
    celebration: Celebration
    onClose: () => void
    onOpenStats: () => void
}

function nameSize(name: string): string {
    if (name.length > 22) return 'clamp(30px, 9vw, 40px)'
    if (name.length > 14) return 'clamp(36px, 11vw, 52px)'
    return 'clamp(44px, 14vw, 68px)'
}

function TrophyMark() {
    const burst = useMemo(() => sparks(BEATS.trophy + 0.12), [])
    return (
        <div className="relative grid size-20 place-items-center sm:size-24">
            <motion.span variants={rays(0.1)} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-[340%] -translate-x-1/2 -translate-y-1/2">
                <motion.span animate={RAYS_TURN} className="champions-rays-fan block size-full rounded-full" />
            </motion.span>
            <motion.span
                variants={aura(BEATS.trophy)}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 size-[220%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: `radial-gradient(circle, ${tint(GOLD, 45)} 0%, ${tint(GOLD, 14)} 34%, transparent 66%)` }}
            />
            {[0, 0.16].map(offset => (
                <motion.span
                    key={offset}
                    variants={shockwave(BEATS.trophy + 0.1 + offset)}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full border-2"
                    style={{ borderColor: GOLD, boxShadow: `0 0 24px ${GOLD}, inset 0 0 14px ${tint(GOLD, 55)}` }}
                />
            ))}
            <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-0">
                {burst.map((variants, index) => (
                    <motion.span
                        key={index}
                        variants={variants}
                        className="absolute -ml-2.5 -mt-px h-0.5 w-5 rounded-full"
                        style={{ background: `linear-gradient(90deg, transparent, ${GOLD} 45%, white)`, boxShadow: `0 0 6px ${GOLD}` }}
                    />
                ))}
            </span>
            <motion.div variants={slam(BEATS.trophy)} className="champions-trophy relative grid size-20 place-items-center rounded-full sm:size-24">
                <Trophy aria-hidden className="size-9 sm:size-11" strokeWidth={2} />
            </motion.div>
        </div>
    )
}

function ConfettiField() {
    const pieces = useMemo(() => confetti(BEATS.trophy + 0.15), [])
    return (
        <span aria-hidden className="champions-confetti pointer-events-none absolute left-1/2 size-0">
            {pieces.map((variants, index) => (
                <motion.span
                    key={index}
                    variants={variants}
                    className={cn(
                        'absolute',
                        index % 3 === 0 ? '-ml-1 -mt-1 size-2 rounded-full' : '-ml-[3px] -mt-1.5 h-3 w-1.5 rounded-[1px]',
                        CONFETTI_TINTS[index % CONFETTI_TINTS.length],
                    )}
                />
            ))}
        </span>
    )
}

function Kicker({ text }: { text: string }) {
    return (
        <div className="flex w-full items-center justify-center gap-3">
            <motion.span variants={rule(BEATS.kicker)} aria-hidden className="champions-rule h-px min-w-3 max-w-16 flex-1 origin-right" />
            <motion.span variants={rise(BEATS.kicker, 6)} className="whitespace-nowrap font-pickban text-xs font-bold uppercase tracking-[0.25em] text-yellow-300 sm:text-sm">
                {text}
            </motion.span>
            <motion.span variants={rule(BEATS.kicker)} aria-hidden className="champions-rule champions-rule-right h-px min-w-3 max-w-16 flex-1 origin-left" />
        </div>
    )
}

function Champion({ member }: { member: CelebrationMember }) {
    return (
        <div className="flex min-w-0 flex-col items-center gap-2.5">
            <span className="champions-avatar-ring rounded-full p-[3px]">
                <PlayerInfo userId={member.user} alias={member.alias} size="xl" presentation="avatar" />
            </span>
            <PlayerInfo userId={member.user} alias={member.alias} size="lg" presentation="name" className="mx-auto max-w-full" />
        </div>
    )
}

function FinalScore({ champion, runnerUp, score }: { champion: string; runnerUp: string; score: Celebration['final_score'] }) {
    return (
        <motion.div variants={rise(BEATS.score)} className="flex w-full flex-col items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Grand Final</span>
            <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-hairline/10 bg-hairline/5 px-4 py-2 font-pickban uppercase">
                <span className="truncate text-right text-lg font-bold text-yellow-300">{champion}</span>
                <span data-final-score className="text-2xl font-black italic tabular-nums">
                    <span className="text-yellow-300">{score.winner}</span>
                    <span className="px-1.5 text-muted-foreground">–</span>
                    <span className="text-muted-foreground">{score.loser}</span>
                </span>
                <span className="truncate text-left text-lg font-bold text-muted-foreground">{runnerUp}</span>
            </div>
        </motion.div>
    )
}

function PodiumCard({ place, order, wide }: { place: CelebrationPlace; order: number; wide: boolean }) {
    const medal = MEDALS[place.place === 2 ? 2 : 3]
    return (
        <motion.div
            variants={rise(BEATS.podium + order * 0.09, 18)}
            className={cn('champions-card relative flex min-w-0 flex-col items-center rounded-xl border border-hairline/10 bg-card/30 px-3 pb-4 pt-8 text-center', wide && 'col-span-2')}
        >
            <span className={cn('champions-medal absolute left-1/2 top-0 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-pickban text-xl font-black italic', medal.medal)}>
                {place.place}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{medal.label}</span>
            <span className="mt-0.5 w-full truncate font-pickban text-xl font-bold uppercase leading-tight text-foreground">{place.team.name}</span>
            <span aria-hidden className="champions-card-rule mt-2.5 h-px w-10" />
            <span className="mt-3 flex max-w-full flex-col items-start gap-1.5">
                {place.team.members.map(member => (
                    <PlayerInfo key={member.user} userId={member.user} alias={member.alias} size="sm" className="max-w-full" />
                ))}
            </span>
        </motion.div>
    )
}

export function ChampionsCelebration({ celebration, onClose, onOpenStats }: ChampionsCelebrationProps) {
    const panelRef = useRef<HTMLDivElement>(null)
    useModalBehaviour(panelRef, true, onClose)
    useBroadcastFonts()
    const reduced = usePrefersReducedMotion()
    const { themeId } = useTheme()
    const light = isLightTheme(themeId)

    useEffect(() => {
        panelRef.current?.focus({ preventScroll: true })
    }, [])

    const champion = celebration.podium.find(place => place.place === 1)
    const runnerUp = celebration.podium.find(place => place.place === 2)
    const others = celebration.podium.filter(place => place.place !== 1)
    if (!champion) return null

    const closeAfterLink = (event: MouseEvent) => {
        if ((event.target as HTMLElement).closest('a, [role="button"]')) window.setTimeout(onClose)
    }

    const openStats = () => {
        onOpenStats()
        onClose()
    }

    return createPortal(
        <MotionConfig skipAnimations={reduced}>
            <motion.div
                data-modal-backdrop
                initial="hidden"
                animate="shown"
                variants={backdrop}
                onClick={event => { if (event.target === event.currentTarget) onClose() }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm touch:backdrop-filter-none"
            >
                <motion.div
                    ref={panelRef}
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="champions-title"
                    variants={panel}
                    className={cn('champions-stage relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl border border-hairline/10 bg-card shadow-2xl outline-none', light && 'champions-stage-light')}
                >
                    <span aria-hidden className="champions-wash pointer-events-none absolute inset-0" />
                    <span aria-hidden className="champions-grid pointer-events-none absolute inset-0" />
                    <span aria-hidden className="champions-edge pointer-events-none absolute inset-x-0 top-0 h-px" />

                    <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-7 sm:px-8 sm:pb-6 sm:pt-8" onClickCapture={closeAfterLink}>
                        <div className="flex flex-col items-center text-center">
                            <TrophyMark />

                            <div className="mt-6 w-full sm:mt-7">
                                <Kicker text={celebration.name} />
                            </div>
                            <motion.p id="champions-title" variants={rise(BEATS.kicker + 0.08, 6)} className="mt-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                                Congratulations to the champions
                            </motion.p>
                            <motion.p
                                data-champion-name
                                variants={stamp(BEATS.name)}
                                className="mt-1 max-w-full text-balance break-words font-pickban font-black uppercase italic leading-[0.95] text-yellow-300"
                                style={{
                                    fontSize: nameSize(champion.team.name),
                                    textShadow: light ? `0 0 28px ${tint(GOLD, 35)}` : `0 0 40px ${tint(GOLD, 50)}, 0 6px 20px rgba(0,0,0,0.5)`,
                                }}
                            >
                                {champion.team.name}
                            </motion.p>

                            <div className="relative mt-5 grid w-full max-w-xs grid-cols-2 gap-4 sm:mt-6">
                                {champion.team.members.map((member, index) => (
                                    <motion.div key={member.user} variants={rise(BEATS.champions + index * 0.08, 18)} className="min-w-0">
                                        <Champion member={member} />
                                    </motion.div>
                                ))}
                                {champion.team.members.length === 2 && (
                                    <motion.span
                                        variants={rise(BEATS.champions + 0.12, 0)}
                                        aria-hidden
                                        className="absolute left-1/2 top-10 -translate-x-1/2 -translate-y-1/2 font-pickban text-2xl font-black italic text-muted-foreground"
                                    >
                                        &amp;
                                    </motion.span>
                                )}
                            </div>

                            {runnerUp && (
                                <div className="mt-5 w-full sm:mt-6">
                                    <FinalScore champion={champion.team.name} runnerUp={runnerUp.team.name} score={celebration.final_score} />
                                </div>
                            )}
                        </div>

                        {others.length > 0 && (
                            <div className="mt-9 grid grid-cols-2 gap-x-3 gap-y-8 sm:mt-10">
                                {others.map((place, index) => (
                                    <PodiumCard key={place.team.id} place={place} order={index} wide={others.length === 3 && index === 0} />
                                ))}
                            </div>
                        )}

                        <motion.div variants={rise(BEATS.actions, 8)} className="mt-6 grid grid-cols-2 gap-2 sm:mt-7 sm:flex sm:justify-center">
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-hairline/10 bg-hairline/5 px-4 text-sm font-semibold text-foreground transition-colors hover:border-hairline/20 hover:bg-hairline/10 sm:w-44"
                            >
                                Close
                            </button>
                            <NavLink
                                view="event-detail"
                                params={{ eventSlug: celebration.slug, eventTab: 'teams' }}
                                onActivate={openStats}
                                ariaLabel="See the cup stats"
                                className="inline-flex h-9 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-promo-gold px-4 text-sm font-semibold text-amber-950 shadow-lg transition duration-200 hover:brightness-110 sm:w-44"
                            >
                                <span className="sm:hidden">Cup stats</span>
                                <span className="hidden sm:inline">See the cup stats</span>
                                <ArrowRight className="size-4" aria-hidden />
                            </NavLink>
                        </motion.div>
                    </div>

                    <ConfettiField />

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-hairline/10 hover:text-foreground"
                    >
                        <X className="size-4" />
                    </button>
                </motion.div>
            </motion.div>
        </MotionConfig>,
        document.body,
    )
}
