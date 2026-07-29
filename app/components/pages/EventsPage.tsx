import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronRight, Trophy, Users2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNewItemHighlight } from '@/app/hooks/useNewItemHighlight'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import { eventErrorMessage, fetchEvents, type EventSummary, type UserProfile } from '@/app/utils/api'
import { EventStatusBadge, formatEventDate, formatTeamSize } from './events/eventsShared'
import type { EventsPageCaches, EventsPageState } from './EventsPage.types'

interface EventsPageProps {
    userProfile?: UserProfile
    state: EventsPageState
    onStateChange: (updater: (prev: EventsPageState) => EventsPageState) => void
    caches: EventsPageCaches
    onCachesChange: (updater: (prev: EventsPageCaches) => EventsPageCaches) => void
    onEventSelect: (slug: string) => void
}

export function EventsPage({ userProfile, state, onStateChange, caches, onCachesChange, onEventSelect }: EventsPageProps) {
    const browseToken = userProfile?.accessToken ?? ''
    const [loading, setLoading] = useState(!caches.loaded)
    const [error, setError] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const cachesRef = useRef(caches)
    cachesRef.current = caches
    const skipScrollRestoreRef = useRef(false)

    const highlight = useNewItemHighlight('events', () => {
        skipScrollRestoreRef.current = true
    }, caches.loaded)

    const load = useCallback(async (background = false) => {
        if (!background) setLoading(true)
        setError(null)
        try {
            const events = await fetchEvents(browseToken)
            onCachesChange(prev => ({
                ...prev,
                events,
                loaded: true,
                lastRefreshIso: new Date().toISOString(),
            }))
        } catch (e) {
            if (!background) setError(eventErrorMessage(e))
        } finally {
            if (!background) setLoading(false)
        }
    }, [browseToken, onCachesChange])

    useEffect(() => { void load(cachesRef.current.loaded) }, [load])

    useEffect(() => {
        if (skipScrollRestoreRef.current) return
        if (scrollRef.current && !loading) scrollRef.current.scrollTop = state.scrollTop
    }, [loading, state.scrollTop])

    useRegisterPageRefresh({
        onRefresh: () => void load(),
        refreshing: loading,
        tooltip: 'Refresh',
    })

    const isNewEvent = (event: EventSummary) =>
        event.status !== 'draft' && highlight.isNew(event.published_at ?? event.created_at)

    const firstNewIdx = caches.events.findIndex(isNewEvent)

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-0 duration-500">
            <div className="shrink-0">
                <h1 className="text-2xl font-bold text-white leading-tight">Events</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Cups and community tournaments — sign up, follow the teams, and don't miss a match.
                </p>
            </div>

            {error && <div className="shrink-0"><ErrorBanner message={error} /></div>}

            <div
                ref={scrollRef}
                onScroll={() => {
                    if (scrollRef.current) {
                        const top = scrollRef.current.scrollTop
                        onStateChange(prev => (prev.scrollTop === top ? prev : { ...prev, scrollTop: top }))
                    }
                }}
                className="flex-1 min-h-0 overflow-auto px-0.5 pb-2"
            >
                {loading && !caches.loaded ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">Loading events…</div>
                ) : caches.events.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        <Trophy className="size-8 mx-auto mb-2 opacity-40" />
                        No events yet. Check back soon!
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {caches.events.map((event, index) => {
                            const dates = [formatEventDate(event.starts_at), formatEventDate(event.ends_at)].filter(Boolean)
                            const isNew = isNewEvent(event)
                            return (
                                <button
                                    key={event.id}
                                    ref={isNew && index === firstNewIdx ? highlight.registerFirstNew : undefined}
                                    onClick={() => onEventSelect(event.slug)}
                                    className={cn(
                                        'text-left p-4 rounded-xl bg-card/30 border border-hairline/5 hover:border-accent-500/40 hover:bg-card/50 transition-colors cursor-pointer space-y-3 group',
                                        isNew && 'bg-accent-500/[0.07] ring-1 ring-inset ring-accent-500/40',
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <h2 className="text-base font-semibold text-foreground leading-snug">{event.name}</h2>
                                        <EventStatusBadge event={event} className="mt-0.5" />
                                    </div>
                                    {event.summary && <p className="text-xs text-muted-foreground line-clamp-2">{event.summary}</p>}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1"><Users2 className="size-3" /> {formatTeamSize(event.team_size)} · {event.team_count} team{event.team_count === 1 ? '' : 's'}</span>
                                        {dates.length > 0 && (
                                            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" /> {dates.join(' – ')}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs font-medium text-accent-300 group-hover:text-accent-200">
                                        {event.signups_open ? 'Sign up now' : 'View event'} <ChevronRight className="size-3.5" />
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
