import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, Link2, Sparkles, Swords, WifiOff, ZapOff } from 'lucide-react'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { buildMatchLinks } from '@/app/components/navigation/matchLinks'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { SITE_NAME } from '@/app/components/navigation/titles'
import type { UserProfile } from '@/app/utils/api'
import { useCopyFeedback } from '@/app/hooks/useCopyFeedback'
import { usePickBanSession, usePickBanView } from '@/app/components/pages/events/pickban/usePickBanSession'
import { useCaptainPlay } from '@/app/components/pages/events/pickban/useCaptainPlay'
import { useManagerDock } from '@/app/components/pages/events/pickban/useManagerDock'
import { usePickBanPreload } from '@/app/components/pages/events/pickban/usePickBanPreload'
import { usePickBanSound } from '@/app/components/pages/events/pickban/usePickBanSound'
import type { PickBanView } from '@/app/components/pages/events/pickban/pickBanView'
import { CaptainDock } from '@/app/components/pages/events/pickban/components/CaptainDock'
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
import { PickBanUnavailable } from '@/app/components/pages/events/pickban/components/PickBanUnavailable'
import { MatchBanner } from '@/app/components/pages/events/pickban/components/MatchBanner'
import { PickBanStage } from '@/app/components/pages/events/pickban/components/PickBanStage'
import { StepTrack } from '@/app/components/pages/events/pickban/components/StepTrack'
import { ExcludedMaps, excludedCardsOf } from '@/app/components/pages/events/pickban/components/ExcludedMaps'

interface MatchPickBanPageProps {
    eventSlug: string
    matchId: string
    userProfile?: UserProfile
    onBackToEvent: () => void
}

const ManagerDock = lazy(() => import('@/app/components/pages/events/pickban/components/ManagerDock').then(m => ({ default: m.ManagerDock })))

const HEADER_BUTTON = 'inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-accent-500/40 bg-accent-500/15 px-3 text-xs font-medium text-accent-200 transition-colors hover:border-accent-500/60 hover:bg-accent-500/25 sm:h-8'

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

    useDocumentTitle(view ? `${view.match.title} — Picks & Bans` : undefined, SITE_NAME)

    const actFor = manager.dock?.actFor ?? null
    const controls = captain.dock ? (
        <CaptainDock
            dock={captain.dock}
            ab={view?.affordances.actingAb ?? null}
            reconnecting={session.reconnecting}
            onLockIn={captain.lockIn}
            onToggleReady={captain.toggleReady}
            onDismiss={captain.dismiss}
        />
    ) : actFor ? (
        <CaptainDock
            dock={actFor.dock}
            ab={actFor.ab}
            actingFor={actFor.teamName}
            reconnecting={session.reconnecting}
            onLockIn={manager.lockIn}
            onDismiss={manager.dismiss}
        />
    ) : null
    const onSelect = captain.dock?.controls?.kind === 'choose'
        ? captain.select
        : actFor?.dock.controls?.kind === 'choose' ? manager.select : undefined

    const bracketLink = (
        <NavLink
            view="event-detail"
            params={{ eventSlug, eventTab: 'bracket' }}
            onActivate={() => navigate('event-detail', { eventSlug, eventTab: 'bracket' })}
            className={HEADER_BUTTON}
        >
            <Swords className="size-3.5" />
            Back to Bracket
        </NavLink>
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <NavLink
                    view="event-detail"
                    params={{ eventSlug }}
                    onActivate={onBackToEvent}
                    className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="size-3.5" />
                    Back to Event
                </NavLink>
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
            </div>

            {view ? (
                <PickBanMotion animate={animate}>
                    <PickBanBody view={view} summaryAction={bracketLink} controls={controls} onSelect={onSelect}>
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

            {session.reconnecting && !controls && <ReconnectingToast />}
        </div>
    )
}

function PickBanBody({ view, summaryAction, controls, onSelect, children }: {
    view: PickBanView
    summaryAction: ReactNode
    controls: ReactNode
    onSelect?: (map: string) => void
    children: ReactNode
}) {
    const notes = view.banners.filter(banner => banner.kind === 'skipped_bans' || banner.kind === 'warning')
    const hasExcluded = excludedCardsOf(view.cards).length > 0

    return (
        <div className="@container/page flex flex-col gap-4">
            <MatchBanner view={view} />

            <PickBanStage
                view={view}
                summaryAction={summaryAction}
                onSelect={onSelect}
                className="@[80rem]/page:min-h-[34rem]"
            />

            {controls}

            {(view.timeline.length > 0 || hasExcluded || notes.length > 0) && (
                <section aria-label="Steps" className="flex flex-col items-center gap-3 rounded-2xl border border-hairline/10 bg-card/30 px-3 py-4 sm:px-5">
                    {view.timeline.length > 0 && <StepTrack entries={view.timeline} skippedBans={view.skippedBans} size="page" />}
                    <ExcludedMaps cards={view.cards} />
                    {notes.map(banner => (
                        <PickBanBannerNote key={banner.key} banner={banner} className="w-full" />
                    ))}
                </section>
            )}

            {children}
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
            aria-label={on ? 'Turn Animations Off' : 'Turn Animations On'}
            className={HEADER_BUTTON}
        >
            <Icon className="size-3.5" />
            {on ? 'Animations On' : 'Animations Off'}
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
            {copied ? 'Copied' : 'Copy Link'}
        </button>
    )
}

function PickBanSkeleton() {
    return (
        <div aria-busy className="flex flex-col gap-4">
            <div className="h-40 animate-pulse rounded-2xl bg-hairline/5" />
            <div className="h-[32rem] animate-pulse rounded-2xl bg-hairline/5" />
            <div className="h-32 animate-pulse rounded-2xl bg-hairline/5" />
        </div>
    )
}
