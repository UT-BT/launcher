import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, Link2, Sparkles, Swords, WifiOff, ZapOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { buildMatchLinks } from '@/app/components/navigation/matchLinks'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { SITE_NAME } from '@/app/components/navigation/titles'
import type { UserProfile } from '@/app/utils/api'
import { useCopyFeedback } from '@/app/hooks/useCopyFeedback'
import { usePickBanSession, usePickBanView } from '@/app/components/pages/events/pickban/usePickBanSession'
import { useCaptainPlay, type UseCaptainPlayResult } from '@/app/components/pages/events/pickban/useCaptainPlay'
import { useManagerDock } from '@/app/components/pages/events/pickban/useManagerDock'
import { usePickBanPreload } from '@/app/components/pages/events/pickban/usePickBanPreload'
import { usePickBanSound } from '@/app/components/pages/events/pickban/usePickBanSound'
import { matchSubtitle } from '@/app/components/pages/events/pickban/pickBanCopy'
import type { PickBanView } from '@/app/components/pages/events/pickban/pickBanView'
import { statusOfPhase } from '@/app/components/pages/events/pickban/pickBanStatus'
import { CaptainDock } from '@/app/components/pages/events/pickban/components/CaptainDock'
import { CentreStage } from '@/app/components/pages/events/pickban/components/CentreStage'
import { PickBanBannerNote } from '@/app/components/pages/events/pickban/components/PickBanBannerNote'
import { PickBanMotion } from '@/app/components/pages/events/pickban/components/PickBanMotion'
import { PickBanSoundControl } from '@/app/components/pages/events/pickban/components/PickBanSoundControl'
import { loadPickBanMotion, savePickBanMotion, subscribePickBanMotion } from '@/app/components/pages/events/pickban/pickBanMotionPreference'
import {
    loadPickBanSoundPreference,
    savePickBanSoundPreference,
    subscribePickBanSoundPreference,
    type PickBanSoundPreference,
} from '@/app/components/pages/events/pickban/pickBanSoundPreference'
import { PickBanStatusChip } from '@/app/components/pages/events/pickban/components/PickBanStatusChip'
import { PickBanUnavailable } from '@/app/components/pages/events/pickban/components/PickBanUnavailable'
import { PoolGrid } from '@/app/components/pages/events/pickban/components/PoolGrid'
import { StepTimeline } from '@/app/components/pages/events/pickban/components/StepTimeline'
import { TeamPanel } from '@/app/components/pages/events/pickban/components/TeamPanel'

interface MatchPickBanPageProps {
    eventSlug: string
    matchId: string
    userProfile?: UserProfile
    onBackToEvent: () => void
}

const ManagerDock = lazy(() => import('@/app/components/pages/events/pickban/components/ManagerDock').then(m => ({ default: m.ManagerDock })))

const HEADER_BUTTON = 'inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-accent-500/40 bg-accent-500/15 px-3 text-xs font-medium text-accent-200 transition-colors hover:border-accent-500/60 hover:bg-accent-500/25 sm:h-8'

const STAGE_HEIGHT = 'h-[22rem] @4xl/page:h-[26rem] @7xl/page:h-[30rem] @[140rem]/page:h-[40rem]'

const STAGE_ROW = 'grid grid-cols-2 gap-3 @4xl/page:grid-cols-[13rem_minmax(0,1fr)_13rem] @7xl/page:grid-cols-[16rem_minmax(0,1fr)_16rem] @[140rem]/page:grid-cols-[22rem_minmax(0,1fr)_22rem]'

export function MatchPickBanPage({ eventSlug, matchId, userProfile, onBackToEvent }: MatchPickBanPageProps) {
    const session = usePickBanSession({ accessToken: userProfile?.accessToken, slug: eventSlug, matchId })
    const captain = useCaptainPlay(usePickBanView(session.state, session.clockOffsetMs), session.sendCommand)
    const manager = useManagerDock(captain.view, session)
    const view = manager.view
    const links = buildMatchLinks(eventSlug, matchId)
    const { navigate } = useNavigation()
    const [soundPreference, setSoundPreference] = useState(loadPickBanSoundPreference)
    const [animate, setAnimate] = useState(loadPickBanMotion)
    usePickBanPreload(view?.cards)
    const sound = usePickBanSound({
        state: session.state,
        clockOffsetMs: session.clockOffsetMs,
        muted: !soundPreference.enabled,
        volume: soundPreference.volume,
    })

    useEffect(() => subscribePickBanSoundPreference(() => setSoundPreference(loadPickBanSoundPreference())), [])
    useEffect(() => subscribePickBanMotion(() => setAnimate(loadPickBanMotion())), [])

    const changeSoundPreference = (next: PickBanSoundPreference) => {
        savePickBanSoundPreference(next)
        setSoundPreference(next)
    }

    useDocumentTitle(view ? `${view.match.title} — Pick/Ban` : undefined, SITE_NAME)

    const bracketLink = (
        <NavLink
            view="event-detail"
            params={{ eventSlug, eventTab: 'bracket' }}
            onActivate={() => navigate('event-detail', { eventSlug, eventTab: 'bracket' })}
            className={HEADER_BUTTON}
        >
            <Swords className="size-3.5" />
            Back to the bracket
        </NavLink>
    )

    return (
        <div className="flex flex-col gap-4">
            <NavLink
                view="event-detail"
                params={{ eventSlug }}
                onActivate={onBackToEvent}
                className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
                <ArrowLeft className="size-3.5" />
                Back to event
            </NavLink>

            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="break-words text-2xl font-bold leading-tight text-foreground">
                            {view?.match.title ?? 'Pick/Ban'}
                        </h1>
                        {view && <PickBanStatusChip status={statusOfPhase(view.phase)} />}
                    </div>
                    <p className="min-h-4 text-xs text-muted-foreground">{view ? matchSubtitle(view.match) : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <PickBanSoundControl
                        preference={soundPreference}
                        onToggle={(enabled) => {
                            if (enabled) sound.unlock()
                            changeSoundPreference({ ...soundPreference, enabled })
                        }}
                        onChange={changeSoundPreference}
                        onPreview={() => {
                            if (soundPreference.enabled) sound.preview('pick')
                        }}
                        className={HEADER_BUTTON}
                    />
                    <MotionToggleButton
                        on={animate}
                        onToggle={() => {
                            savePickBanMotion(!animate)
                            setAnimate(!animate)
                        }}
                    />
                    <CopyLinkButton link={links.playerLink} />
                </div>
            </header>

            {view ? (
                <PickBanMotion animate={animate}>
                    <PickBanBody
                        view={view}
                        summaryAction={bracketLink}
                        captain={captain}
                        onManagerSelect={manager.dock?.actFor?.dock.controls?.kind === 'choose' ? manager.select : undefined}
                        reconnecting={session.reconnecting}
                    >
                        {manager.dock && (
                            <Suspense fallback={null}>
                                <ManagerDock manager={manager} slug={eventSlug} accessToken={userProfile?.accessToken} links={links} />
                            </Suspense>
                        )}
                    </PickBanBody>
                </PickBanMotion>
            ) : session.loading ? (
                <PickBanSkeleton />
            ) : (
                <PickBanUnavailable
                    error={session.error}
                    icon={Swords}
                    className="rounded-xl border border-hairline/10 bg-card/30 px-4 py-20"
                />
            )}

            {session.reconnecting && !captain.dock && <ReconnectingToast />}
        </div>
    )
}

function PickBanBody({ view, summaryAction, captain, onManagerSelect, reconnecting, children }: {
    view: PickBanView
    summaryAction: ReactNode
    captain: UseCaptainPlayResult
    onManagerSelect?: (map: string) => void
    reconnecting: boolean
    children: ReactNode
}) {
    const notes = view.banners.filter(banner => banner.kind === 'skipped_bans' || banner.kind === 'warning')
    const eligibleCount = view.cards.filter(card => card.state !== 'excluded').length
    const exclusionReasons = [...new Set(view.cards.flatMap(card => card.state === 'excluded' && card.exclusionReason ? [card.exclusionReason] : []))]

    return (
        <div className="@container/page flex flex-col gap-4">
            <div className={STAGE_ROW}>
                <TeamPanel panel={view.teams.left} className="@4xl/page:order-1" />
                <TeamPanel panel={view.teams.right} className="@4xl/page:order-3" />
                <CentreStage
                    view={view}
                    summaryAction={summaryAction}
                    className={cn('col-span-2 @4xl/page:order-2 @4xl/page:col-span-1', STAGE_HEIGHT)}
                />
            </div>

            <section className="space-y-2.5 rounded-xl border border-hairline/5 bg-card/30 p-3 sm:p-4">
                <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Steps · {view.timeline.length}
                </h2>
                <StepTimeline entries={view.timeline} skippedBans={view.skippedBans} />
                {notes.map(banner => (
                    <PickBanBannerNote key={banner.key} banner={banner} />
                ))}
            </section>

            <section className="space-y-2.5 rounded-xl border border-hairline/5 bg-card/30 p-3 sm:p-4">
                <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Map pool · {eligibleCount} eligible
                </h2>
                <PoolGrid
                    cards={view.cards}
                    previewActor={view.turn?.ab ?? null}
                    onSelect={captain.dock?.controls?.kind === 'choose' ? captain.select : onManagerSelect}
                />
                {exclusionReasons.map(reason => (
                    <p key={reason} className="text-xs text-muted-foreground">{reason}</p>
                ))}
            </section>

            {children}

            {captain.dock && (
                <CaptainDock
                    dock={captain.dock}
                    ab={view.affordances.actingAb}
                    reconnecting={reconnecting}
                    onLockIn={captain.lockIn}
                    onToggleReady={captain.toggleReady}
                    onDismiss={captain.dismiss}
                />
            )}
        </div>
    )
}

function ReconnectingToast() {
    return (
        <div
            role="status"
            className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-card px-2.5 py-1.5 text-xs font-medium text-amber-300"
        >
            <WifiOff className="size-3.5" />
            Reconnecting…
        </div>
    )
}

function MotionToggleButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    const Icon = on ? Sparkles : ZapOff

    return (
        <button
            type="button"
            onClick={onToggle}
            aria-pressed={on}
            aria-label={on ? 'Turn pick/ban animations off' : 'Turn pick/ban animations on'}
            className={HEADER_BUTTON}
        >
            <Icon className="size-3.5" />
            {on ? 'Animations on' : 'Animations off'}
        </button>
    )
}

function CopyLinkButton({ link }: { link: string }) {
    const { copiedKey, copy } = useCopyFeedback(err => console.error('Copy pick/ban link failed', err))
    const copied = copiedKey === link

    return (
        <button
            type="button"
            onClick={() => copy(link, link)}
            className={HEADER_BUTTON}
        >
            {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
        </button>
    )
}

function PickBanSkeleton() {
    return (
        <div aria-busy className="@container/page flex flex-col gap-4">
            <div className={STAGE_ROW}>
                <div className="h-44 animate-pulse rounded-xl bg-hairline/5 @4xl/page:order-1 @4xl/page:h-auto" />
                <div className="h-44 animate-pulse rounded-xl bg-hairline/5 @4xl/page:order-3 @4xl/page:h-auto" />
                <div className={cn('col-span-2 animate-pulse rounded-xl bg-hairline/5 @4xl/page:order-2 @4xl/page:col-span-1', STAGE_HEIGHT)} />
            </div>
            <div className="h-24 animate-pulse rounded-xl bg-hairline/5" />
            <div className="h-56 animate-pulse rounded-xl bg-hairline/5" />
        </div>
    )
}
