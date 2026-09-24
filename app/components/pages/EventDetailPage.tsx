import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarClock, CalendarDays, Users2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useUnsavedChanges } from '@/app/components/navigation/useUnsavedChanges'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { MarkdownBody } from '@/app/components/shared/MarkdownBody'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import { formatSlotTime, useDisplayTimezone } from '@/app/utils/timezone'
import {
    eventErrorMessage, fetchEvent, fetchEventBracket, fetchEventLfp, fetchEventPredictions,
    fetchEventTeams, fetchMyEventStatus, fetchMySchedule, fetchPickBanConfig,
    type EventBracket, type EventDetail, type EventFormatSpec, type EventLfpEntry, type EventMatch, type EventTeam,
    type MyEventStatus, type PickBanConfig, type PredictionsOverview, type ScheduleEntry, type UserProfile,
} from '@/app/utils/api'
import { EventStatusBadge, formatEventDate, formatEventDateTime, formatTeamSize, scheduleTabVisible } from './events/eventsShared'
import { EventTeamsList } from './events/EventTeamsList'
import { EventLfpList } from './events/EventLfpList'
import { SignupPanel } from './events/SignupPanel'
import { ManagePanel } from './events/ManagePanel'
import { BracketTab } from './events/bracket/BracketTab'
import { nextOwnMatch, sideOf, teamLabel } from './events/bracket/bracketShared'
import { EventRosterProvider } from './events/TeamRoster'
import { MapsTab } from './events/maps/MapsTab'
import { stagesWithPools } from './events/maps/mapsShared'
import { pickBanJoinBannerVisible } from './events/pickban/pickBanEntryPoints'
import { PredictionsTab } from './events/predictions/PredictionsTab'
import { PredictionOddsProvider, formatCountdown, useNow } from './events/predictions/predictionsShared'
import { ScheduleTab } from './events/schedule/ScheduleTab'
import type { PickBanDrafts } from './events/manage/pickban/pickBanEditor'
import { SlotPickerModal } from './events/schedule/SlotPickerModal'

const PICK_BAN_ME_REFRESH_MS = 30_000

function PickBanJoinBanner({ eventSlug, matchId }: { eventSlug: string; matchId: string }) {
    const { navigate } = useNavigation()

    return (
        <NavLink
            view="match-pickban"
            params={{ eventSlug, matchId }}
            onActivate={() => navigate('match-pickban', { eventSlug, matchId })}
            className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs shrink-0 cursor-pointer hover:bg-emerald-500/15 transition-colors"
        >
            <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-foreground font-medium">Pick/Ban open – Join</span>
        </NavLink>
    )
}

function NextMatchBanner({ match, myTeamId, now }: {
    match: EventMatch
    myTeamId: string
    now: number
}) {
    const timezone = useDisplayTimezone()
    const opponent = sideOf(match, myTeamId) === 'a' ? match.team_b : match.team_a
    const scheduledAt = match.scheduled_at
    const countdown = formatCountdown(scheduledAt, now)

    if (!countdown || !scheduledAt) return null

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-500/25 bg-accent-500/10 px-3 py-2 text-xs shrink-0">
            <CalendarClock className="size-3.5 shrink-0 text-accent-300" />
            <span className="min-w-0 truncate text-foreground">
                Your next match vs {teamLabel(opponent)} · {formatSlotTime(scheduledAt, timezone)}
            </span>
            <span className="ml-auto shrink-0 font-medium tabular-nums text-accent-300">{countdown}</span>
        </div>
    )
}

export type EventTab = 'info' | 'teams' | 'bracket' | 'maps' | 'predictions' | 'schedule' | 'players' | 'signup' | 'manage'

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
    { id: 'maps', label: 'Maps' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'predictions', label: 'Predictions' },
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
    const [predictions, setPredictions] = useState<PredictionsOverview | null>(null)
    const [predictionsLoaded, setPredictionsLoaded] = useState(false)
    const [schedule, setSchedule] = useState<ScheduleEntry[] | null>(null)
    const [scheduleLoaded, setScheduleLoaded] = useState(false)
    const [pickBanConfig, setPickBanConfig] = useState<PickBanConfig | null>(null)
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

    const loadPredictions = useCallback(async (enabled: boolean) => {
        if (!enabled) {
            setPredictions(null)
            setPredictionsLoaded(true)
            return
        }
        try {
            setPredictions(await fetchEventPredictions(browseToken, eventSlug))
        } catch {
            setPredictions(null)
        } finally {
            setPredictionsLoaded(true)
        }
    }, [browseToken, eventSlug])

    const loadPickBanConfig = useCallback(async () => {
        try {
            setPickBanConfig(await fetchPickBanConfig(browseToken, eventSlug))
        } catch {
            setPickBanConfig(null)
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

    const canSeeSchedule = scheduleTabVisible(!!my?.team, !!my?.can_manage_bracket || !!my?.can_manage)

    const loadSchedule = useCallback(async (enabled: boolean) => {
        if (!enabled || !accessToken) {
            setSchedule(null)
            setScheduleLoaded(true)
            return
        }
        try {
            const items = await fetchMySchedule(accessToken)
            setSchedule(items.filter(item => item.tournament.slug === eventSlug))
        } catch {
            setSchedule(null)
        } finally {
            setScheduleLoaded(true)
        }
    }, [accessToken, eventSlug])

    useEffect(() => { void load() }, [load])
    useEffect(() => { void loadMy() }, [loadMy])
    useEffect(() => {
        const timer = setInterval(() => { void loadMy() }, PICK_BAN_ME_REFRESH_MS)
        return () => clearInterval(timer)
    }, [loadMy])
    useEffect(() => { void loadBracket() }, [loadBracket])
    useEffect(() => { void loadPredictions(!!event?.predictions_enabled) }, [loadPredictions, event?.predictions_enabled])
    useEffect(() => { void loadSchedule(canSeeSchedule) }, [loadSchedule, canSeeSchedule])
    useEffect(() => { void loadPickBanConfig() }, [loadPickBanConfig])

    const refreshPredictions = useCallback(() => {
        void loadPredictions(!!event?.predictions_enabled)
    }, [loadPredictions, event?.predictions_enabled])

    const refreshSchedule = useCallback(() => {
        void loadSchedule(canSeeSchedule)
    }, [loadSchedule, canSeeSchedule])

    const refresh = useCallback(() => {
        void load(true)
        void loadMy()
        void loadBracket()
        refreshPredictions()
        refreshSchedule()
        void loadPickBanConfig()
    }, [load, loadMy, loadBracket, refreshPredictions, refreshSchedule, loadPickBanConfig])

    useRegisterPageRefresh({
        onRefresh: () => { void load(); void loadMy(); void loadBracket(); refreshPredictions(); refreshSchedule(); void loadPickBanConfig() },
        refreshing: loading,
        tooltip: 'Refresh',
    })

    const [formatDraft, setFormatDraft] = useState<EventFormatSpec | null>(null)
    const [pickBanDrafts, setPickBanDrafts] = useState<PickBanDrafts>({})
    const [schedulerMatchId, setSchedulerMatchId] = useState<string | null>(null)

    useUnsavedChanges(formatDraft !== null, 'The tournament format has edits you have not saved yet.')
    useUnsavedChanges(Object.keys(pickBanDrafts).length > 0, 'The pick/ban setup has edits you have not saved yet.')

    const now = useNow(1000)
    const myTeamId = my?.team?.id ?? null
    const nextMatch = useMemo(() => nextOwnMatch(bracket?.stages ?? [], myTeamId, now), [bracket, myTeamId, now])
    const mapsStages = useMemo(() => stagesWithPools(pickBanConfig), [pickBanConfig])
    const hasMapsPool = mapsStages.length > 0

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
    const hasBracket = (bracket?.stages?.length ?? 0) > 0
    const predictionsOn = !!event.predictions_enabled
    const visibleTabs = (canManageBracket ? TABS : BASE_TABS)
        .filter(t => t.id !== 'bracket' || hasBracket)
        .filter(t => t.id !== 'maps' || hasMapsPool)
        .filter(t => t.id !== 'predictions' || predictionsOn)
        .filter(t => t.id !== 'schedule' || canSeeSchedule)
    const scheduleAwaitingCount = (schedule ?? []).filter(e => !!myTeamId && !!e.proposal && e.whose_turn === myTeamId).length
    const activeTab = (tab === 'manage' && !canManageBracket)
        || (tab === 'bracket' && !hasBracket)
        || (tab === 'maps' && !hasMapsPool)
        || (tab === 'predictions' && !predictionsOn)
        || (tab === 'schedule' && !canSeeSchedule) ? 'info' : tab

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
                {pickBanJoinBannerVisible(my?.pick_ban_session ?? null) && my?.pick_ban_session && (
                    <PickBanJoinBanner eventSlug={eventSlug} matchId={my.pick_ban_session.match_id} />
                )}
                {nextMatch && myTeamId && <NextMatchBanner match={nextMatch} myTeamId={myTeamId} now={now} />}

                <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
                    {visibleTabs.map(t => {
                        const inviteCount = t.id === 'signup' ? (my?.invitations?.length ?? 0) : 0
                        const scheduleCount = t.id === 'schedule' ? scheduleAwaitingCount : 0
                        const badgeCount = inviteCount || scheduleCount
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
                                {badgeCount > 0 ? (
                                    <span
                                        title={scheduleCount > 0 ? `${scheduleCount} match${scheduleCount === 1 ? '' : 'es'} waiting on your team to pick a time` : undefined}
                                        className="min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-accent-500 text-[10px] font-bold text-white leading-none"
                                    >
                                        {badgeCount}
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
                <PredictionOddsProvider markets={predictions?.markets ?? []}>
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
                {activeTab === 'bracket' && (
                    <BracketTab bracket={bracket} loading={loading} onMapSelect={onMapSelect} onScheduleMatch={setSchedulerMatchId}
                        eventSlug={eventSlug} myTeamId={myTeamId} />
                )}
                {activeTab === 'maps' && hasMapsPool && (
                    <MapsTab stages={mapsStages} onMapSelect={onMapSelect} />
                )}
                {activeTab === 'schedule' && canSeeSchedule && (
                    <ScheduleTab
                        myTeamId={my?.team?.id ?? null}
                        entries={schedule}
                        loaded={scheduleLoaded}
                        onRefresh={refreshSchedule}
                        onOpenPicker={setSchedulerMatchId}
                        eventSlug={eventSlug}
                        pickBanSession={my?.pick_ban_session}
                    />
                )}
                {activeTab === 'predictions' && predictionsOn && (
                    <PredictionsTab
                        slug={eventSlug}
                        userProfile={userProfile}
                        data={predictions}
                        loaded={predictionsLoaded}
                        onRefresh={refreshPredictions}
                        onMapSelect={onMapSelect}
                    />
                )}
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
                        onBracketChange={next => { setBracket(next); refreshPredictions() }}
                        onMapSelect={onMapSelect}
                        onRefresh={refresh}
                        formatDraft={formatDraft}
                        onFormatDraftChange={setFormatDraft}
                        pickBanDrafts={pickBanDrafts}
                        onPickBanDraftsChange={setPickBanDrafts}
                        onPickBanConfigChange={setPickBanConfig}
                    />
                )}
                </PredictionOddsProvider>
                </EventRosterProvider>
            </div>

            {accessToken && schedulerMatchId && (
                <SlotPickerModal
                    isOpen
                    onClose={() => setSchedulerMatchId(null)}
                    slug={eventSlug}
                    matchId={schedulerMatchId}
                    accessToken={accessToken}
                    myTeamId={myTeamId}
                    canManage={canManageBracket}
                    bracket={bracket}
                    onChanged={refresh}
                />
            )}
        </div>
    )
}
