import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, Users2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useUnsavedChanges } from '@/app/components/navigation/useUnsavedChanges'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { MarkdownBody } from '@/app/components/shared/MarkdownBody'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEvent, fetchEventBracket, fetchEventLfp, fetchEventTeams, fetchMyEventStatus,
    type EventBracket, type EventDetail, type EventFormatSpec, type EventLfpEntry, type EventTeam,
    type MyEventStatus, type UserProfile,
} from '@/app/utils/api'
import { EventStatusBadge, formatEventDate, formatEventDateTime, formatTeamSize } from './events/eventsShared'
import { EventTeamsList } from './events/EventTeamsList'
import { EventLfpList } from './events/EventLfpList'
import { SignupPanel } from './events/SignupPanel'
import { ManagePanel } from './events/ManagePanel'
import { BracketTab } from './events/bracket/BracketTab'
import { EventRosterProvider } from './events/TeamRoster'

export type EventTab = 'info' | 'teams' | 'bracket' | 'players' | 'signup' | 'manage'

interface EventDetailPageProps {
    eventSlug: string
    userProfile?: UserProfile
    initialTab?: string
    onMapSelect?: (mapName: string) => void
    onBack: () => void
}

const BASE_TABS: { id: EventTab; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'teams', label: 'Teams' },
    { id: 'bracket', label: 'Bracket' },
    { id: 'players', label: 'Looking for Partner' },
    { id: 'signup', label: 'Signup' },
]

const MANAGE_TAB: { id: EventTab; label: string } = { id: 'manage', label: 'Manage' }

const TABS = [...BASE_TABS, MANAGE_TAB]

export function EventDetailPage({ eventSlug, userProfile, initialTab, onMapSelect, onBack }: EventDetailPageProps) {
    const accessToken = userProfile?.accessToken
    const browseToken = accessToken ?? ''
    const validInitial = TABS.some(tab => tab.id === initialTab) ? initialTab as EventTab : 'info'
    const [tab, setTab] = useNavState<EventTab>('event.tab', validInitial)

    const [event, setEvent] = useState<EventDetail | null>(null)
    const [teams, setTeams] = useState<EventTeam[]>([])
    const [lfp, setLfp] = useState<EventLfpEntry[]>([])
    const [bracket, setBracket] = useState<EventBracket | null>(null)
    const [my, setMy] = useState<MyEventStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [myLoading, setMyLoading] = useState(!!accessToken)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async (background = false) => {
        if (!background) setLoading(true)
        setError(null)
        try {
            const [eventData, teamsData, lfpData] = await Promise.all([
                fetchEvent(browseToken, eventSlug),
                fetchEventTeams(browseToken, eventSlug),
                fetchEventLfp(browseToken, eventSlug),
            ])
            setEvent(eventData)
            setTeams(teamsData)
            setLfp(lfpData)
        } catch (e) {
            if (!background) setError(eventErrorMessage(e))
        } finally {
            if (!background) setLoading(false)
        }
    }, [browseToken, eventSlug])

    const loadBracket = useCallback(async () => {
        try {
            setBracket(await fetchEventBracket(browseToken, eventSlug))
        } catch {
            setBracket(null)
        }
    }, [browseToken, eventSlug])

    const loadMy = useCallback(async () => {
        if (!accessToken) {
            setMy(null)
            setMyLoading(false)
            return
        }
        setMyLoading(true)
        try {
            setMy(await fetchMyEventStatus(accessToken, eventSlug))
        } catch {
            setMy(null)
        } finally {
            setMyLoading(false)
        }
    }, [accessToken, eventSlug])

    useEffect(() => { void load() }, [load])
    useEffect(() => { void loadMy() }, [loadMy])
    useEffect(() => { void loadBracket() }, [loadBracket])

    const refresh = useCallback(() => {
        void load(true)
        void loadMy()
        void loadBracket()
    }, [load, loadMy, loadBracket])

    useRegisterPageRefresh({
        onRefresh: () => { void load(); void loadMy(); void loadBracket() },
        refreshing: loading,
        tooltip: 'Refresh',
    })

    // The format builder's unsaved edit lives here, above every tab on this page,
    // so switching tab — inner or outer — cannot throw it away. Only leaving the
    // page or reloading does, which is exactly what the guard warns about.
    const [formatDraft, setFormatDraft] = useState<EventFormatSpec | null>(null)

    useUnsavedChanges(formatDraft !== null, 'The tournament format has edits you have not saved yet.')

    if (loading && !event) {
        return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Loading event…</div>
    }

    if (error && !event) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4">
                <ErrorBanner message={error} />
                <button onClick={onBack} className="text-sm text-accent-300 hover:underline cursor-pointer">Back to events</button>
            </div>
        )
    }

    if (!event) return null

    const dates = [formatEventDate(event.starts_at), formatEventDate(event.ends_at)].filter(Boolean)
    const signupCloses = formatEventDateTime(event.signup_closes_at)
    const signupOpens = formatEventDateTime(event.signup_opens_at)
    const canManage = !!my?.can_manage
    const canManageBracket = !!my?.can_manage_bracket || canManage
    const hasBracket = (bracket?.stages.length ?? 0) > 0
    const visibleTabs = (canManageBracket ? TABS : BASE_TABS).filter(t => t.id !== 'bracket' || hasBracket)
    const activeTab = (tab === 'manage' && !canManageBracket) || (tab === 'bracket' && !hasBracket) ? 'info' : tab

    return (
        <div className="h-full flex flex-col overflow-hidden space-y-4 animate-in fade-in slide-in-from-bottom-0 duration-500">
            <div className="shrink-0 space-y-3">
                <button
                    onClick={onBack}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors cursor-pointer"
                >
                    <ArrowLeft className="size-3.5" /> All events
                </button>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-white leading-tight">{event.name}</h1>
                    <EventStatusBadge event={event} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Users2 className="size-3.5" /> {formatTeamSize(event.team_size)} · {event.team_count} team{event.team_count === 1 ? '' : 's'} signed up{event.max_teams != null && ` · ${event.registered_team_count}/${event.max_teams} spots filled`}</span>
                    {dates.length > 0 && (
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" /> {dates.join(' – ')}</span>
                    )}
                    {event.signups_open && signupCloses && <span className="text-emerald-300">Signups close {signupCloses}</span>}
                    {!event.signups_open && event.status === 'announced' && signupOpens && <span className="text-sky-300">Signups open {signupOpens}</span>}
                </div>
                {error && <ErrorBanner message={error} />}

                <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
                    {visibleTabs.map(t => {
                        const inviteCount = t.id === 'signup' ? (my?.invitations?.length ?? 0) : 0
                        const signupCallout = t.id === 'signup' && event.signups_open && !my?.team
                        return (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer',
                                    activeTab === t.id
                                        ? 'border-accent-400 text-white'
                                        : signupCallout
                                            ? 'border-transparent text-accent-300 hover:text-accent-200'
                                            : 'border-transparent text-muted-foreground hover:text-white',
                                )}
                            >
                                {t.label}
                                {inviteCount > 0 ? (
                                    <span className="min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold text-white leading-none">
                                        {inviteCount}
                                    </span>
                                ) : signupCallout && activeTab !== t.id ? (
                                    <span className="relative flex size-1.5">
                                        <span className="absolute inline-flex h-full w-full rounded-full bg-accent-400 opacity-75 animate-ping" />
                                        <span className="relative inline-flex size-1.5 rounded-full bg-accent-400" />
                                    </span>
                                ) : null}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto px-0.5 pb-2">
                <EventRosterProvider teams={teams}>
                {activeTab === 'info' && (
                    <div className="space-y-6 max-w-3xl">
                        {event.summary && <p className="text-sm text-foreground">{event.summary}</p>}
                        {event.description ? (
                            <MarkdownBody className="text-sm">{event.description}</MarkdownBody>
                        ) : (
                            <p className="text-sm text-muted-foreground">More details coming soon.</p>
                        )}
                        {event.rules && (
                            <div className="space-y-2">
                                <h2 className="text-sm font-semibold text-foreground">Rules</h2>
                                <MarkdownBody className="text-sm">{event.rules}</MarkdownBody>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'teams' && <EventTeamsList teams={teams} teamSize={event.team_size} loading={loading} />}
                {activeTab === 'bracket' && <BracketTab bracket={bracket} loading={loading} onMapSelect={onMapSelect} />}
                {activeTab === 'players' && <EventLfpList entries={lfp} loading={loading} />}
                {activeTab === 'signup' && (
                    <div className="max-w-2xl">
                        <SignupPanel
                            accessToken={accessToken}
                            userProfile={userProfile}
                            event={event}
                            my={my}
                            myLoading={myLoading}
                            onRefresh={refresh}
                        />
                    </div>
                )}
                {activeTab === 'manage' && canManageBracket && accessToken && (
                    <ManagePanel
                        accessToken={accessToken}
                        slug={eventSlug}
                        event={event}
                        lfp={lfp}
                        bracket={bracket}
                        canManageEvent={canManage}
                        onBracketChange={setBracket}
                        onMapSelect={onMapSelect}
                        onRefresh={refresh}
                        formatDraft={formatDraft}
                        onFormatDraftChange={setFormatDraft}
                    />
                )}
                </EventRosterProvider>
            </div>
        </div>
    )
}
