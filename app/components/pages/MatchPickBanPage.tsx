import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Check, Link2, Swords, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { buildMatchLinks } from '@/app/components/navigation/matchLinks'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { SITE_NAME } from '@/app/components/navigation/titles'
import { ApiError, type UserProfile } from '@/app/utils/api'
import { usePickBanSession, usePickBanView } from '@/app/components/pages/events/pickban/usePickBanSession'
import type { PickBanView, PickBanViewPhase } from '@/app/components/pages/events/pickban/pickBanView'
import { CentreStage } from '@/app/components/pages/events/pickban/components/CentreStage'
import { PickBanBannerNote } from '@/app/components/pages/events/pickban/components/PickBanBannerNote'
import { PoolGrid } from '@/app/components/pages/events/pickban/components/PoolGrid'
import { StepTimeline } from '@/app/components/pages/events/pickban/components/StepTimeline'
import { TeamPanel } from '@/app/components/pages/events/pickban/components/TeamPanel'

interface MatchPickBanPageProps {
    eventSlug: string
    matchId: string
    userProfile?: UserProfile
    onBackToEvent: () => void
}

const STAGE_HEIGHT = 'h-[22rem] @4xl/page:h-[26rem] @7xl/page:h-[30rem] @[140rem]/page:h-[40rem]'

const STAGE_ROW = 'grid grid-cols-2 gap-3 @4xl/page:grid-cols-[13rem_minmax(0,1fr)_13rem] @7xl/page:grid-cols-[16rem_minmax(0,1fr)_16rem] @[140rem]/page:grid-cols-[22rem_minmax(0,1fr)_22rem]'

const STATUS_PILL: Record<PickBanViewPhase, { label: string; className: string }> = {
    none: { label: 'Not open', className: 'border-hairline/10 bg-hairline/5 text-muted-foreground' },
    lobby: { label: 'Lobby', className: 'border-accent-500/40 bg-accent-500/15 text-accent-200' },
    intro: { label: 'Live', className: 'border-red-500/30 bg-red-500/10 text-red-300' },
    awaiting: { label: 'Live', className: 'border-red-500/30 bg-red-500/10 text-red-300' },
    spotlight: { label: 'Live', className: 'border-red-500/30 bg-red-500/10 text-red-300' },
    paused: { label: 'Paused', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
    complete: { label: 'Complete', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
    cancelled: { label: 'Cancelled', className: 'border-hairline/10 bg-hairline/5 text-muted-foreground' },
    voided: { label: 'Voided', className: 'border-red-500/30 bg-red-500/10 text-red-300' },
}

export function MatchPickBanPage({ eventSlug, matchId, userProfile, onBackToEvent }: MatchPickBanPageProps) {
    const session = usePickBanSession({ accessToken: userProfile?.accessToken, slug: eventSlug, matchId })
    const view = usePickBanView(session.state, session.clockOffsetMs)
    const { navigate } = useNavigation()

    useDocumentTitle(view ? `${view.match.title} — Pick/Ban` : undefined, SITE_NAME)

    const bracketLink = (
        <NavLink
            view="event-detail"
            params={{ eventSlug, eventTab: 'bracket' }}
            onActivate={() => navigate('event-detail', { eventSlug, eventTab: 'bracket' })}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-accent-500/40 bg-accent-500/15 px-3 text-xs font-medium text-accent-200 transition-colors hover:border-accent-500/60 hover:bg-accent-500/25"
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
                        {view && <StatusPill phase={view.phase} />}
                    </div>
                    <p className="min-h-4 text-xs text-muted-foreground">{view ? matchSubtitle(view) : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <CopyLinkButton link={buildMatchLinks(eventSlug, matchId).playerLink} />
                </div>
            </header>

            {view?.banners.filter(banner => banner.kind === 'voided' || banner.kind === 'cancelled' || banner.kind === 'warning').map(banner => (
                <PickBanBannerNote key={banner.key} banner={banner} />
            ))}

            {view ? (
                <PickBanBody view={view} summaryAction={bracketLink} />
            ) : session.loading ? (
                <PickBanSkeleton />
            ) : (
                <Unavailable error={session.error} />
            )}

            {session.reconnecting && <ReconnectingToast />}
        </div>
    )
}

function matchSubtitle(view: PickBanView): string {
    return [view.match.stageName, view.match.roundLabel, `Best of ${view.match.bestOf}`].filter(Boolean).join(' · ')
}

function PickBanBody({ view, summaryAction }: { view: PickBanView; summaryAction: ReactNode }) {
    const skipped = view.banners.find(banner => banner.kind === 'skipped_bans')
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
                {skipped && <PickBanBannerNote banner={skipped} />}
            </section>

            <section className="space-y-2.5 rounded-xl border border-hairline/5 bg-card/30 p-3 sm:p-4">
                <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Map pool · {eligibleCount} eligible
                </h2>
                <PoolGrid cards={view.cards} previewActor={view.turn?.ab ?? null} />
                {exclusionReasons.map(reason => (
                    <p key={reason} className="text-xs text-muted-foreground">{reason}</p>
                ))}
            </section>
        </div>
    )
}

function StatusPill({ phase }: { phase: PickBanViewPhase }) {
    const { label, className } = STATUS_PILL[phase]
    return (
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest', className)}>
            {label}
        </span>
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

function CopyLinkButton({ link }: { link: string }) {
    const [copied, setCopied] = useState(false)
    const timer = useRef<number | null>(null)

    useEffect(() => () => {
        if (timer.current !== null) window.clearTimeout(timer.current)
    }, [])

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link)
            setCopied(true)
            if (timer.current !== null) window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => setCopied(false), 1500)
        } catch (err) {
            console.error('Copy pick/ban link failed', err)
        }
    }

    return (
        <button
            type="button"
            onClick={copy}
            className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-accent-500/40 bg-accent-500/15 px-3 text-xs font-medium text-accent-200 transition-colors hover:border-accent-500/60 hover:bg-accent-500/25"
        >
            {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
        </button>
    )
}

function Unavailable({ error }: { error: unknown }) {
    const hidden = error instanceof ApiError && [401, 403, 404].includes(error.status)
    return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-hairline/10 bg-card/30 px-4 py-20 text-center">
            <Swords className="size-8 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
                {hidden ? 'This pick/ban isn’t available' : 'Couldn’t load this pick/ban'}
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
                {hidden
                    ? 'The match may not be published yet, or the link is wrong.'
                    : 'Trying again in the background.'}
            </p>
        </div>
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
