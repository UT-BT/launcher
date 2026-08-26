import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense, type Dispatch, type SetStateAction } from 'react'
import { AppLayout } from '@/app/components/layout/AppLayout'
import { ErrorBoundary } from '@/app/components/ErrorBoundary'
import { trackPage } from '@/app/utils/telemetry'
import {
  NavigationContext,
  paramsEqual,
  type NavEntry,
  type NavParams,
  type NavigationContextValue,
} from '@/app/components/navigation/NavigationContext'
import { Home, DEFAULT_HOME_CACHES, type HomePageCaches } from '@/app/components/pages/Home'
import { PAGE_LOADERS, warmAllPages } from '@/app/components/main/pageLoaders'
import {
  DEFAULT_SERVERS_STATE,
  DEFAULT_SERVERS_CACHES,
  type ServerBrowserState,
  type ServerBrowserCaches,
} from '@/app/components/pages/ServerBrowserPage.types'
import {
  DEFAULT_MAPS_STATE,
  DEFAULT_MAPS_CACHES,
  type MapsPageState,
  type MapsPageCaches,
} from '@/app/components/pages/MapsPage.types'
import {
  DEFAULT_PLAYERS_STATE,
  DEFAULT_PLAYERS_CACHES,
  type PlayersPageState,
  type PlayersPageCaches,
} from '@/app/components/pages/PlayersPage.types'
import {
  DEFAULT_CAP_IT_ALL_STATE,
  DEFAULT_CAP_IT_ALL_CACHES,
  type CapItAllPageState,
  type CapItAllPageCaches,
} from '@/app/components/pages/CapItAllPage.types'
import {
  DEFAULT_WORLD_RECORDS_STATE,
  DEFAULT_WORLD_RECORDS_CACHES,
  type WorldRecordsPageState,
  type WorldRecordsPageCaches,
} from '@/app/components/pages/WorldRecordsPage.types'
import {
  DEFAULT_ACHIEVEMENTS_STATE,
  DEFAULT_ACHIEVEMENTS_CACHES,
  type AchievementsPageState,
  type AchievementsPageCaches,
} from '@/app/components/pages/AchievementsPage.types'
import {
  DEFAULT_TEAMS_STATE,
  DEFAULT_TEAMS_CACHES,
  type TeamsPageState,
  type TeamsPageCaches,
} from '@/app/components/pages/TeamsPage.types'
import {
  DEFAULT_EVENTS_STATE,
  DEFAULT_EVENTS_CACHES,
  type EventsPageState,
  type EventsPageCaches,
} from '@/app/components/pages/EventsPage.types'
import { DEFAULT_ADMIN_STATE, type AdminPageState } from '@/app/components/pages/admin/types'

const ServerBrowserPage = lazy(PAGE_LOADERS.servers)
const MapsPage = lazy(PAGE_LOADERS.maps)
const PlayersPage = lazy(PAGE_LOADERS.players)
const CapItAllPage = lazy(PAGE_LOADERS['cap-it-all'])
const WorldRecordsPage = lazy(PAGE_LOADERS['world-records'])
const AchievementsPage = lazy(PAGE_LOADERS.achievements)
const TeamsPage = lazy(PAGE_LOADERS.teams)
const EventsPage = lazy(PAGE_LOADERS.events)
const NewsPage = lazy(PAGE_LOADERS.news)

const TeamDetailsPage = lazy(() => import('@/app/components/pages/teams/TeamDetailsPage').then(m => ({ default: m.TeamDetailsPage })))
const EventDetailPage = lazy(() => import('@/app/components/pages/EventDetailPage').then(m => ({ default: m.EventDetailPage })))
const MapDetailPage = lazy(() => import('@/app/components/pages/MapDetailPage').then(m => ({ default: m.MapDetailPage })))
const PlayerDetailPage = lazy(() => import('@/app/components/pages/PlayerDetailPage').then(m => ({ default: m.PlayerDetailPage })))
const CapDetailPage = lazy(() => import('@/app/components/pages/CapDetailPage').then(m => ({ default: m.CapDetailPage })))
const TeamCapDetailPage = lazy(() => import('@/app/components/pages/TeamCapDetailPage').then(m => ({ default: m.TeamCapDetailPage })))
const NewsDetailPage = lazy(() => import('@/app/components/pages/NewsDetailPage').then(m => ({ default: m.NewsDetailPage })))
const AdminPage = lazy(() => import('@/app/components/pages/admin/AdminPage').then(m => ({ default: m.AdminPage })))
const ConfirmModal = lazy(() => import('@/app/components/shared/ConfirmModal').then(m => ({ default: m.ConfirmModal })))
import { InstallationBanner } from '@/app/components/InstallationBanner'
import { UpdateBanner } from '@/app/components/updater/UpdateBanner'
import { FavoritesSyncModal } from '@/app/components/shared/FavoritesSyncModal'
import { AuthRequiredModal, LOGIN_REQUIRED_EVENT, type LoginRequest } from '@/app/components/shared/AuthRequiredModal'
import { PatreonModal } from '@/app/components/modals/PatreonModal'
import type { ServerPreset } from '@/app/utils/server-utils'
import { useFavorites } from '@/app/hooks/useFavorites'
import { useServerFavorites } from '@/app/hooks/useServerFavorites'
import { loadPatreonMembers } from '@/app/utils/patreon'
import { fetchAchievementDefinitions, fetchMyAchievements, fetchNavBadges, markSectionSeen, type BadgeSection } from '@/app/utils/api'
import { getSynced, setSynced, subscribeSynced } from '@/app/utils/userState'
import { writePendingHighlight, type HighlightView } from '@/app/hooks/useNewItemHighlight'
import { isStaff } from '@/app/utils/roles'
import { capabilities, IS_WEB } from '@/app/platform'
import { pushUrlForEntry, seedEntriesFromUrl, useUrlSync } from '@/app/components/navigation/useUrlSync'
import { useDocumentMeta } from '@/app/components/navigation/useDocumentMeta'


const MAPS_STATE_STORAGE_KEY = 'utbt:mapsPageState:v1'
const SERVERS_STATE_STORAGE_KEY = 'utbt:serversState:v1'
const PLAYERS_STATE_STORAGE_KEY = 'utbt:playersState:v1'
const CAP_IT_ALL_STATE_STORAGE_KEY = 'utbt:capItAllState:v1'
const WORLD_RECORDS_STATE_STORAGE_KEY = 'utbt:worldRecordsState:v1'
const ACHIEVEMENTS_STATE_STORAGE_KEY = 'utbt:achievementsState:v1'
const TEAMS_STATE_STORAGE_KEY = 'utbt:teamsState:v2'
const EVENTS_STATE_STORAGE_KEY = 'utbt:eventsState:v1'
const ADMIN_STATE_STORAGE_KEY = 'utbt:adminState:v1'
const SERVER_PRESETS_STORAGE_KEY = 'utbt:serverPresets:v1'

const HISTORY_CAP = 50

const BADGE_SECTIONS = {
  'maps': 'maps',
  'world-records': 'world_records',
  'events': 'events',
  'news': 'news',
} satisfies Record<HighlightView, BadgeSection>

function isBadgedView(view: string): view is HighlightView {
  return view in BADGE_SECTIONS
}

const LEGACY_SEEN_KEYS: Record<string, string> = {
  'maps': 'utbt:newMapsSeen:v1',
  'world-records': 'utbt:newRecordsSeen:v1',
  'events': 'utbt:newEventsSeen:v1',
  'news': 'utbt:newsSeen:v1',
}

function readLegacySeen(view: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(LEGACY_SEEN_KEYS[view])
  } catch {
    return null
  }
}

const MAPS_PREF_KEYS: readonly (keyof MapsPageState)[] = ['filtersPanelOpen', 'pageSizePreference']
const SERVERS_PREF_KEYS: readonly (keyof ServerBrowserState)[] = ['columnVisibility', 'columnOrder', 'filtersPanelOpen']
const PLAYERS_PREF_KEYS: readonly (keyof PlayersPageState)[] = ['columnVisibility', 'columnOrder', 'pageSizePreference']
const CAP_IT_ALL_PREF_KEYS: readonly (keyof CapItAllPageState)[] = ['pageSizePreference']
const WORLD_RECORDS_PREF_KEYS: readonly (keyof WorldRecordsPageState)[] = ['columnVisibility', 'columnOrder', 'pageSizePreference', 'filtersPanelOpen']
const ACHIEVEMENTS_PREF_KEYS: readonly (keyof AchievementsPageState)[] = []
const TEAMS_PREF_KEYS: readonly (keyof TeamsPageState)[] = []
const EVENTS_PREF_KEYS: readonly (keyof EventsPageState)[] = []
const ADMIN_PREF_KEYS: readonly (keyof AdminPageState)[] = ['activeSection']

function pickKeys<T extends object>(o: T, keys: readonly (keyof T)[]): Partial<T> {
  const r: Partial<T> = {}
  for (const k of keys) r[k] = o[k]
  return r
}

function loadPrefs<T extends object>(storageKey: string, def: T, prefKeys: readonly (keyof T)[]): Partial<T> {
  const result = pickKeys(def, prefKeys)
  if (typeof window === 'undefined' || prefKeys.length === 0) return result
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return result
    const parsed = JSON.parse(raw) as any
    for (const k of prefKeys) {
      if (parsed?.[k] !== undefined) (result as any)[k] = parsed[k]
    }
    return result
  } catch {
    return result
  }
}

function usePageState<T extends object>(
  storageKey: string,
  def: T,
  prefKeys: readonly (keyof T)[],
  getEntryState: <V>(key: string, d: V) => V,
  updateEntryState: <V>(key: string, updater: (prev: V | undefined) => V) => void,
): [T, Dispatch<SetStateAction<T>>] {
  const [prefs, setPrefs] = useState<Partial<T>>(() => loadPrefs(storageKey, def, prefKeys))

  useEffect(() => {
    if (prefKeys.length === 0) return
    try { window.localStorage.setItem(storageKey, JSON.stringify(prefs)) } catch { /* ignore */ }
  }, [storageKey, prefKeys, prefs])

  const initial = useMemo(() => ({ ...def, ...prefs } as T), [def, prefs])
  const initialRef = useRef(initial)
  initialRef.current = initial

  const entryKey = `page:${storageKey}`
  const state = getEntryState<T>(entryKey, initial)

  const onChange = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const apply = (prev: T): T => typeof action === 'function' ? (action as (p: T) => T)(prev) : action
    if (prefKeys.length > 0) {
      const next = apply(state)
      setPrefs(prev => {
        const changed = prefKeys.some(k => next[k] !== prev[k])
        return changed ? { ...prev, ...pickKeys(next, prefKeys) } : prev
      })
    }
    updateEntryState<T>(entryKey, prev => apply(prev ?? initialRef.current))
  }, [state, entryKey, prefKeys, setPrefs, updateEntryState])

  return [state, onChange]
}

function loadPersistedServerPresets(): ServerPreset[] {
  const raw = getSynced<unknown>(SERVER_PRESETS_STORAGE_KEY, [])
  return Array.isArray(raw) ? raw as ServerPreset[] : []
}

export function Main({ userProfile }: { userProfile?: import('@/app/utils/api').UserProfile }) {
  const [entries, setEntries] = useState<NavEntry[]>(seedEntriesFromUrl)
  const [cursor, setCursor] = useState(0)
  const nextIdRef = useRef(1)
  const stackRef = useRef({ entries, cursor })
  stackRef.current = { entries, cursor }
  const [installationStatus, setInstallationStatus] = useState<'valid' | 'no-install' | 'unsupported' | null>(null)
  const [mapsCaches, setMapsCaches] = useState<MapsPageCaches>(DEFAULT_MAPS_CACHES)
  const [serversCaches, setServersCaches] = useState<ServerBrowserCaches>(DEFAULT_SERVERS_CACHES)
  const [playersCaches, setPlayersCaches] = useState<PlayersPageCaches>(DEFAULT_PLAYERS_CACHES)
  const [capItAllCaches, setCapItAllCaches] = useState<CapItAllPageCaches>(DEFAULT_CAP_IT_ALL_CACHES)
  const [worldRecordsCaches, setWorldRecordsCaches] = useState<WorldRecordsPageCaches>(DEFAULT_WORLD_RECORDS_CACHES)
  const [achievementsCaches, setAchievementsCaches] = useState<AchievementsPageCaches>(DEFAULT_ACHIEVEMENTS_CACHES)
  const [homeCaches, setHomeCaches] = useState<HomePageCaches>(DEFAULT_HOME_CACHES)
  const [teamsCaches, setTeamsCaches] = useState<TeamsPageCaches>(DEFAULT_TEAMS_CACHES)
  const [eventsCaches, setEventsCaches] = useState<EventsPageCaches>(DEFAULT_EVENTS_CACHES)
  const [serverPresets, setServerPresets] = useState<ServerPreset[]>(loadPersistedServerPresets)
  const achievementsInFlightRef = useRef<Promise<void> | null>(null)
  const [loginRequest, setLoginRequest] = useState<LoginRequest | null>(null)

  useEffect(() => {
    const onLoginRequired = (event: Event) => setLoginRequest((event as CustomEvent<LoginRequest>).detail)
    window.addEventListener(LOGIN_REQUIRED_EVENT, onLoginRequired)
    return () => window.removeEventListener(LOGIN_REQUIRED_EVENT, onLoginRequired)
  }, [])

  useEffect(() => {
    void loadPatreonMembers()
  }, [])

  useEffect(() => {
    if (IS_WEB) return
    warmAllPages()
  }, [])

  const updateServerPresets = useCallback((next: ServerPreset[]) => {
    setServerPresets(next)
    setSynced(SERVER_PRESETS_STORAGE_KEY, next)
  }, [])

  useEffect(() => subscribeSynced(SERVER_PRESETS_STORAGE_KEY, () => setServerPresets(loadPersistedServerPresets())), [])

  const accessToken = userProfile?.accessToken
  const userId = userProfile?.id ?? undefined

  const ensureAchievements = useCallback(async (force = false) => {
    if (!accessToken) return
    if (achievementsInFlightRef.current) return achievementsInFlightRef.current

    let shouldFetch = force
    setAchievementsCaches(prev => {
      if (!force && (prev.status === 'ready' || prev.status === 'loading')) return prev
      shouldFetch = true
      return { ...prev, status: 'loading' }
    })
    if (!shouldFetch) return

    const run = (async () => {
      try {
        const [definitions, mine] = await Promise.all([
          fetchAchievementDefinitions(accessToken),
          fetchMyAchievements(accessToken),
        ])
        setAchievementsCaches(prev => ({
          ...prev,
          definitions,
          progress: mine.items,
          lastRefreshIso: new Date().toISOString(),
          status: 'ready',
        }))
      } catch (e) {
        console.error('Achievement stamp-on-load failed:', e)
        setAchievementsCaches(prev => ({ ...prev, status: 'error' }))
      } finally {
        achievementsInFlightRef.current = null
      }
    })()

    achievementsInFlightRef.current = run
    return run
  }, [accessToken])

  // Single source of truth for map favorites. See app/hooks/useFavorites.ts.
  const {
    favoriteMapNames,
    toggle: toggleFavorite,
    syncModal,
    resolveSync,
    dismissSync,
  } = useFavorites(accessToken, userId)

  const toggleFavoriteOrLogin = useCallback((mapName: string) => {
    if (!accessToken) {
      setLoginRequest({ feature: 'save favorites', description: 'Sign in to save favorite maps to your profile and sync them across devices.' })
      return
    }
    toggleFavorite(mapName)
  }, [accessToken, toggleFavorite])

  const { favoriteServerIds, toggle: toggleServerFavorite } = useServerFavorites(accessToken, userId)

  const toggleServerFavoriteOrLogin = useCallback((serverId: string) => {
    if (!accessToken) {
      setLoginRequest({ feature: 'save favorites', description: 'Sign in to save favorite servers to your profile and sync them across the launcher and the website.' })
      return
    }
    void toggleServerFavorite(serverId)
  }, [accessToken, toggleServerFavorite])

  const [badgeCounts, setBadgeCounts] = useState<Record<string, number | null>>({})
  const [badgeSeen, setBadgeSeen] = useState<Record<string, string | null>>({})
  const badgeCountsRef = useRef(badgeCounts)
  badgeCountsRef.current = badgeCounts
  const badgeSeenRef = useRef(badgeSeen)
  badgeSeenRef.current = badgeSeen
  const badgesLoadedRef = useRef(false)
  const badgesAsOfRef = useRef<string | null>(null)
  const pendingViewedRef = useRef(new Set<string>())
  const accessTokenRef = useRef(accessToken)
  accessTokenRef.current = accessToken

  const markViewed = useCallback((view: string, { highlight = true } = {}) => {
    if (!isBadgedView(view)) return
    const section = BADGE_SECTIONS[view]
    const token = accessTokenRef.current
    if (!token) return
    if (!badgesLoadedRef.current) {
      pendingViewedRef.current.add(view)
      return
    }
    const count = badgeCountsRef.current[view]
    if (count === 0) return
    const previousSeen = badgeSeenRef.current[view] ?? null
    const stamp = badgesAsOfRef.current ?? new Date().toISOString()
    badgeCountsRef.current = { ...badgeCountsRef.current, [view]: 0 }
    badgeSeenRef.current = { ...badgeSeenRef.current, [view]: stamp }
    setBadgeCounts(prev => ({ ...prev, [view]: 0 }))
    setBadgeSeen(prev => ({ ...prev, [view]: stamp }))
    if (highlight && count != null && count > 0) {
      const activeView = stackRef.current.entries[stackRef.current.cursor]?.view
      if (activeView !== view) writePendingHighlight(view, previousSeen)
      window.dispatchEvent(new CustomEvent('highlight-new', { detail: { view, since: previousSeen } }))
    }
    markSectionSeen(token, section, stamp).catch(() => undefined)
  }, [])

  // Badges are server-computed against per-user seen markers ("new since my
  // last visit"), so they need the badges endpoint rather than the heavier
  // summary payload, and they refetch on focus to pick up marks made on
  // another device. Legacy per-device localStorage markers seed the server
  // marker once, then are removed.
  const refreshBadges = useCallback(async () => {
    const token = accessTokenRef.current
    if (!token) {
      badgesLoadedRef.current = false
      pendingViewedRef.current.clear()
      setBadgeCounts({})
      setBadgeSeen({})
      return
    }
    try {
      let nav = await fetchNavBadges(token)
      const migrations = Object.entries(BADGE_SECTIONS).filter(([view, section]) =>
        nav.seen[section] === null && readLegacySeen(view) !== null)
      if (migrations.length > 0) {
        const migrated = await Promise.all(migrations.map(([view, section]) =>
          markSectionSeen(token, section, readLegacySeen(view) ?? undefined).then(() => view).catch(() => null)))
        migrated.forEach(view => {
          if (view === null) return
          try { window.localStorage.removeItem(LEGACY_SEEN_KEYS[view]) } catch { /* ignore */ }
        })
        nav = await fetchNavBadges(token)
      }
      if (accessTokenRef.current !== token) return
      badgesAsOfRef.current = nav.as_of ?? new Date().toISOString()
      const counts: Record<string, number | null> = {}
      const seen: Record<string, string | null> = {}
      for (const [view, section] of Object.entries(BADGE_SECTIONS)) {
        counts[view] = nav.sections[section]?.count ?? null
        seen[view] = nav.seen[section] ?? null
      }
      badgeCountsRef.current = counts
      badgeSeenRef.current = seen
      badgesLoadedRef.current = true
      setBadgeCounts(counts)
      setBadgeSeen(seen)
      const toMark = new Set(pendingViewedRef.current)
      pendingViewedRef.current.clear()
      toMark.forEach(view => markViewed(view))
      const activeView = stackRef.current.entries[stackRef.current.cursor].view
      if (!toMark.has(activeView)) markViewed(activeView, { highlight: false })
    } catch { /* offline or an older API: no badges this session */ }
  }, [markViewed])

  useEffect(() => {
    void refreshBadges()
  }, [refreshBadges, accessToken])

  useEffect(() => {
    const onFocus = () => {
      if (accessTokenRef.current) void refreshBadges()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshBadges])

  const badgeVisible = useCallback((view: string): boolean => {
    const count = badgeCounts[view]
    return count != null && count > 0
  }, [badgeCounts])

  const leaveGuardsRef = useRef(new Map<string, () => string | null>())
  const [pendingLeave, setPendingLeave] = useState<
    { message: string; view?: string; params?: NavParams; move?: () => void }
  | null>(null)

  const registerLeaveGuard = useCallback((key: string, prompt: () => string | null) => {
    leaveGuardsRef.current.set(key, prompt)
    return () => { leaveGuardsRef.current.delete(key) }
  }, [])

  const leaveWarning = useCallback(() => {
    for (const prompt of leaveGuardsRef.current.values()) {
      const message = prompt()
      if (message) return message
    }
    return null
  }, [])

  const commitNavigate = useCallback((view: string, params: NavParams = {}) => {
    markViewed(view)
    const { entries: cur, cursor: curIdx } = stackRef.current
    const active = cur[curIdx] ?? cur[cur.length - 1]
    if (active?.view === view && paramsEqual(active.params, params)) return
    const entry = { id: nextIdRef.current++, view, params, state: {} }
    let next = [...cur.slice(0, curIdx + 1), entry]
    let nextCursor = next.length - 1
    if (next.length > HISTORY_CAP) {
      const drop = next.length - HISTORY_CAP
      next = next.slice(drop)
      nextCursor -= drop
    }
    setEntries(next)
    setCursor(nextCursor)
    pushUrlForEntry(entry)
  }, [markViewed])

  const navigate = useCallback((view: string, params: NavParams = {}) => {
    const { entries: cur, cursor: curIdx } = stackRef.current
    const active = cur[curIdx] ?? cur[cur.length - 1]
    const staying = active?.view === view && paramsEqual(active.params, params)
    const message = staying ? null : leaveWarning()

    if (message) {
      setPendingLeave({ view, params, message })
      return
    }

    commitNavigate(view, params)
  }, [commitNavigate, leaveWarning])

  const guarded = useCallback((move: () => void) => () => {
    const message = leaveWarning()

    if (message) {
      setPendingLeave({ move, message })
      return
    }

    move()
  }, [leaveWarning])

  const pushExternal = useCallback((view: string, params: NavParams) => {
    markViewed(view)
    const { entries: cur, cursor: curIdx } = stackRef.current
    const entry = { id: nextIdRef.current++, view, params, state: {} }
    let next = [...cur.slice(0, curIdx + 1), entry]
    let nextCursor = next.length - 1
    if (next.length > HISTORY_CAP) {
      const drop = next.length - HISTORY_CAP
      next = next.slice(drop)
      nextCursor -= drop
    }
    setEntries(next)
    setCursor(nextCursor)
    return entry.id
  }, [markViewed])

  const urlNav = useUrlSync({ stackRef, setCursor, pushExternal })

  const localBack = useCallback(() => setCursor(c => Math.max(0, c - 1)), [])
  const localForward = useCallback(() => setCursor(c => Math.min(stackRef.current.entries.length - 1, c + 1)), [])
  const back = useMemo(() => guarded(urlNav ? urlNav.back : localBack), [guarded, urlNav, localBack])
  const forward = useMemo(() => guarded(urlNav ? urlNav.forward : localForward), [guarded, urlNav, localForward])

  const getEntryState = useCallback(<T,>(key: string, def: T): T => {
    const { entries: cur, cursor: curIdx } = stackRef.current
    const v = cur[curIdx]?.state[key]
    return (v === undefined ? def : v) as T
  }, [])

  const setEntryState = useCallback((key: string, value: unknown) => {
    const { entries: cur, cursor: curIdx } = stackRef.current
    const targetId = cur[curIdx]?.id
    setEntries(prev => prev.map(e => e.id === targetId ? { ...e, state: { ...e.state, [key]: value } } : e))
  }, [])

  const updateEntryState = useCallback(<V,>(key: string, updater: (prev: V | undefined) => V) => {
    const { entries: cur, cursor: curIdx } = stackRef.current
    const targetId = cur[curIdx]?.id
    setEntries(prev => prev.map(e => e.id === targetId
      ? { ...e, state: { ...e.state, [key]: updater(e.state[key] as V | undefined) } }
      : e))
  }, [])

  const entry = entries[cursor] ?? entries[entries.length - 1]
  const currentView = entry.view
  const canBack = cursor > 0
  const canForward = cursor < entries.length - 1

  useDocumentMeta(currentView, entry.params)

  useEffect(() => { trackPage(currentView) }, [entry.id, currentView])

  const navValue = useMemo<NavigationContextValue>(() => ({
    entry, currentView, navigate, back, forward, canBack, canForward, getEntryState, setEntryState,
    registerLeaveGuard,
  }), [entry, currentView, navigate, back, forward, canBack, canForward, getEntryState, setEntryState, registerLeaveGuard])

  const [mapsState, setMapsState] = usePageState(MAPS_STATE_STORAGE_KEY, DEFAULT_MAPS_STATE, MAPS_PREF_KEYS, getEntryState, updateEntryState)
  const [serversState, setServersState] = usePageState(SERVERS_STATE_STORAGE_KEY, DEFAULT_SERVERS_STATE, SERVERS_PREF_KEYS, getEntryState, updateEntryState)
  const [playersState, setPlayersState] = usePageState(PLAYERS_STATE_STORAGE_KEY, DEFAULT_PLAYERS_STATE, PLAYERS_PREF_KEYS, getEntryState, updateEntryState)
  const [capItAllState, setCapItAllState] = usePageState(CAP_IT_ALL_STATE_STORAGE_KEY, DEFAULT_CAP_IT_ALL_STATE, CAP_IT_ALL_PREF_KEYS, getEntryState, updateEntryState)
  const [worldRecordsState, setWorldRecordsState] = usePageState(WORLD_RECORDS_STATE_STORAGE_KEY, DEFAULT_WORLD_RECORDS_STATE, WORLD_RECORDS_PREF_KEYS, getEntryState, updateEntryState)
  const [achievementsState, setAchievementsState] = usePageState(ACHIEVEMENTS_STATE_STORAGE_KEY, DEFAULT_ACHIEVEMENTS_STATE, ACHIEVEMENTS_PREF_KEYS, getEntryState, updateEntryState)
  const [teamsState, setTeamsState] = usePageState(TEAMS_STATE_STORAGE_KEY, DEFAULT_TEAMS_STATE, TEAMS_PREF_KEYS, getEntryState, updateEntryState)
  const [eventsState, setEventsState] = usePageState(EVENTS_STATE_STORAGE_KEY, DEFAULT_EVENTS_STATE, EVENTS_PREF_KEYS, getEntryState, updateEntryState)
  const [adminState, setAdminState] = usePageState(ADMIN_STATE_STORAGE_KEY, DEFAULT_ADMIN_STATE, ADMIN_PREF_KEYS, getEntryState, updateEntryState)

  useEffect(() => {
    const onOpenPlayer = (e: Event) => {
      const ce = e as CustomEvent<{ userId: string | number }>
      if (ce.detail?.userId == null) return
      navigate('player-detail', { playerId: ce.detail.userId })
    }
    window.addEventListener('open-player', onOpenPlayer as EventListener)
    return () => window.removeEventListener('open-player', onOpenPlayer as EventListener)
  }, [navigate])

  useEffect(() => {
    const onOpenCap = (e: Event) => {
      const ce = e as CustomEvent<{ capId: string }>
      if (!ce.detail?.capId) return
      navigate('cap-detail', { capId: ce.detail.capId })
    }
    window.addEventListener('open-cap', onOpenCap as EventListener)
    return () => window.removeEventListener('open-cap', onOpenCap as EventListener)
  }, [navigate])

  useEffect(() => {
    const onOpenTeamCap = (e: Event) => {
      const ce = e as CustomEvent<{ teamCapId: string }>
      if (!ce.detail?.teamCapId) return
      navigate('team-cap-detail', { teamCapId: ce.detail.teamCapId })
    }
    window.addEventListener('open-team-cap', onOpenTeamCap as EventListener)
    return () => window.removeEventListener('open-team-cap', onOpenTeamCap as EventListener)
  }, [navigate])

  useEffect(() => {
    const onOpenNews = (e: Event) => {
      const ce = e as CustomEvent<{ newsId: number }>
      if (ce.detail?.newsId == null) return
      navigate('news-detail', { newsId: ce.detail.newsId })
    }
    window.addEventListener('open-news', onOpenNews as EventListener)
    return () => window.removeEventListener('open-news', onOpenNews as EventListener)
  }, [navigate])

  // Stamp achievements + grant earned titles on launcher load, even if the user
  // never opens the Achievements page. GET /me stamps server-side and is
  // idempotent (unique constraint + existing-set check), so it's safe to fire on
  // every sign-in. Single-flight so Home and the Achievements page share one fetch
  // rather than racing; both read the resulting cache.
  useEffect(() => {
    if (!accessToken) return
    void ensureAchievements()
  }, [accessToken, ensureAchievements])

  const openMap = useCallback((name: string) => navigate('maps-detail', { mapName: name }), [navigate])
  const openTeam = useCallback((teamId: string) => navigate('team-detail', { teamId }), [navigate])
  const openEvent = useCallback((eventSlug: string) => navigate('event-detail', { eventSlug }), [navigate])
  const exitTeamsToGallery = useCallback(() => {
    setTeamsCaches(prev => ({ ...prev, loaded: false }))
    navigate('teams')
  }, [navigate])

  useEffect(() => {
    if (IS_WEB) return
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 3) { e.preventDefault(); back() }
      else if (e.button === 4) { e.preventDefault(); forward() }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); back() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); forward() }
    }
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [back, forward])

  useEffect(() => {
    validateInstallation()

    const removePatchStatusListener = window.utPatch?.onPatchInstallStatus((data) => {
      if (data.status === 'complete') {
        setTimeout(() => validateInstallation(), 500)
      }
    })

    const removePathUpdateListener = window.utPatch?.onInstallationPathUpdated(() => {
      setTimeout(() => validateInstallation(), 500)
    })

    return () => {
      removePatchStatusListener?.()
      removePathUpdateListener?.()
    }
  }, [])

  useEffect(() => {
    const titlebarContext = document.getElementById('titlebar-context')
    if (titlebarContext) {
      const disabled = installationStatus !== 'valid'
      titlebarContext.dispatchEvent(new CustomEvent('set-titlebar-game-profiles-disabled', {
        detail: { disabled }
      }))
    }
  }, [installationStatus])

  const validateInstallation = async () => {
    if (!capabilities.install) return
    try {
      const result = await window.conveyor.app.validateCurrentInstallation()

      if (!result.valid) {
        setInstallationStatus('no-install')
      } else if (result.version === 'Unsupported') {
        setInstallationStatus('unsupported')
      } else {
        setInstallationStatus('valid')
      }
    } catch (error) {
      console.error('Failed to validate installation:', error)
      setInstallationStatus('no-install')
    }
  }


  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Home
          userProfile={userProfile as any}
          installationStatus={installationStatus}
          favoriteMapNames={favoriteMapNames}
          favoriteServerIds={favoriteServerIds}
          caches={homeCaches}
          onCachesChange={setHomeCaches}
          achievementsCaches={achievementsCaches}
          onEnsureAchievements={ensureAchievements}
          onToggleFavorite={toggleFavoriteOrLogin}
          onToggleServerFavorite={toggleServerFavoriteOrLogin}
          onMapSelect={openMap}
          onViewServers={() => navigate('servers')}
          onViewMaps={() => navigate('maps')}
          onViewWorldRecords={() => navigate('world-records')}
          onViewPlayers={() => navigate('players')}
          onViewNewMaps={() => navigate('maps', { mapsNewOnly: true })}
          onViewNews={() => navigate('news')}
        />
      case 'servers':
        return <ServerBrowserPage
          installationStatus={installationStatus}
          state={serversState}
          onStateChange={setServersState}
          caches={serversCaches}
          onCachesChange={setServersCaches}
          favoriteServerIds={favoriteServerIds}
          onToggleServerFavorite={toggleServerFavoriteOrLogin}
          presets={serverPresets}
          onPresetsChange={updateServerPresets}
          onMapSelect={openMap}
        />
      case 'maps':
        return <MapsPage
          userProfile={userProfile as any}
          state={mapsState}
          onStateChange={setMapsState}
          caches={mapsCaches}
          onCachesChange={setMapsCaches}
          onMapSelect={openMap}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavoriteOrLogin}
          initialNewOnly={entry.params.mapsNewOnly}
        />
      case 'players':
        return <PlayersPage
          userProfile={userProfile as any}
          state={playersState}
          onStateChange={setPlayersState}
          caches={playersCaches}
          onCachesChange={setPlayersCaches}
        />
      case 'cap-it-all':
        return <CapItAllPage
          userProfile={userProfile as any}
          state={capItAllState}
          onStateChange={setCapItAllState}
          caches={capItAllCaches}
          onCachesChange={setCapItAllCaches}
        />
      case 'world-records':
        return <WorldRecordsPage
          userProfile={userProfile as any}
          state={worldRecordsState}
          onStateChange={setWorldRecordsState}
          caches={worldRecordsCaches}
          onCachesChange={setWorldRecordsCaches}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavoriteOrLogin}
          onMapSelect={openMap}
        />
      case 'achievements':
        return <AchievementsPage
          userProfile={userProfile as any}
          state={achievementsState}
          onStateChange={setAchievementsState}
          caches={achievementsCaches}
          onCachesChange={setAchievementsCaches}
        />
      case 'teams':
        return <TeamsPage
          userProfile={userProfile}
          state={teamsState}
          onStateChange={setTeamsState}
          caches={teamsCaches}
          onCachesChange={setTeamsCaches}
          onTeamSelect={openTeam}
        />
      case 'team-detail':
        return <TeamDetailsPage
          key={entry.id}
          teamId={entry.params.teamId!}
          userProfile={userProfile}
          onExitToGallery={exitTeamsToGallery}
        />
      case 'events':
        return <EventsPage
          userProfile={userProfile}
          state={eventsState}
          onStateChange={setEventsState}
          caches={eventsCaches}
          onCachesChange={setEventsCaches}
          onEventSelect={openEvent}
        />
      case 'event-detail':
        return <EventDetailPage
          key={entry.id}
          eventSlug={entry.params.eventSlug!}
          userProfile={userProfile}
          initialTab={entry.params.eventTab}
          onMapSelect={openMap}
          onBack={() => navigate('events')}
        />
      case 'admin':
        return <AdminPage
          state={adminState}
          onStateChange={setAdminState}
          userProfile={userProfile}
          forceDenied={!isStaff(userProfile)}
          onMapSelect={openMap}
        />
      case 'maps-detail':
        return <MapDetailPage
          key={entry.id}
          mapName={entry.params.mapName!}
          userProfile={userProfile as any}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavoriteOrLogin}
          onMapSelect={openMap}
        />
      case 'player-detail':
        return <PlayerDetailPage
          key={entry.id}
          userId={entry.params.playerId!}
          userProfile={userProfile as any}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavoriteOrLogin}
          onMapSelect={openMap}
        />
      case 'cap-detail':
        return <CapDetailPage
          key={entry.id}
          capId={entry.params.capId!}
          userProfile={userProfile as any}
          onMapSelect={openMap}
        />
      case 'team-cap-detail':
        return <TeamCapDetailPage
          key={entry.id}
          teamCapId={entry.params.teamCapId!}
          userProfile={userProfile as any}
          onMapSelect={openMap}
        />
      case 'news':
        return <NewsPage userProfile={userProfile as any} />
      case 'news-detail':
        return <NewsDetailPage
          key={entry.id}
          newsId={entry.params.newsId!}
          userProfile={userProfile as any}
        />
      default:
        return <Home
          userProfile={userProfile as any}
          newsSeenIso={badgeSeen['news'] ?? null}
          favoriteMapNames={favoriteMapNames}
          favoriteServerIds={favoriteServerIds}
          caches={homeCaches}
          onCachesChange={setHomeCaches}
          achievementsCaches={achievementsCaches}
          onEnsureAchievements={ensureAchievements}
          onToggleFavorite={toggleFavoriteOrLogin}
          onToggleServerFavorite={toggleServerFavoriteOrLogin}
          onMapSelect={openMap}
          onViewServers={() => navigate('servers')}
          onViewMaps={() => navigate('maps')}
          onViewWorldRecords={() => navigate('world-records')}
          onViewPlayers={() => navigate('players')}
          onViewNewMaps={() => navigate('maps', { mapsNewOnly: true })}
          onViewNews={() => navigate('news')}
        />
    }
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <UpdateBanner />
      {installationStatus && installationStatus !== 'valid' && (
        <InstallationBanner
          type={installationStatus}
          onClick={() => window.dispatchEvent(new CustomEvent('open-settings', { detail: { section: 'game-installation' } }))}
        />
      )}
      <div className="flex-1 overflow-hidden">
        <NavigationContext.Provider value={navValue}>
          <AppLayout currentView={currentView} onViewChange={navigate} getNavBadge={(view) => badgeVisible(view) ? badgeCounts[view] : null} userProfile={userProfile} installationStatus={installationStatus}>
            <ErrorBoundary key={entry.id} variant="view" context={currentView} onNavigateHome={currentView === 'home' ? undefined : () => navigate('home')}>
              <Suspense fallback={
                <div className="space-y-4 pt-2">
                  <div className="h-10 w-64 bg-hairline/5 rounded-lg animate-pulse" />
                  <div className="h-72 bg-hairline/5 rounded-xl animate-pulse" />
                </div>
              }>
                {renderView()}
              </Suspense>
            </ErrorBoundary>
          </AppLayout>
        </NavigationContext.Provider>
      </div>
      <FavoritesSyncModal
        open={syncModal.open}
        dbFavorites={syncModal.db}
        iniFavorites={syncModal.ini}
        onResolve={resolveSync}
        onDismiss={dismissSync}
      />
      <PatreonModal />
      <AuthRequiredModal request={loginRequest} onClose={() => setLoginRequest(null)} />
      {pendingLeave && (
        <Suspense fallback={null}>
          <ConfirmModal
            isOpen
            onClose={() => setPendingLeave(null)}
            onConfirm={() => {
              const target = pendingLeave
              setPendingLeave(null)
              if (target.move) target.move()
              else if (target.view) commitNavigate(target.view, target.params ?? {})
            }}
            title="Leave without saving?"
            message={pendingLeave.message}
            detail="Anything you have not saved is lost."
            confirmText="Leave"
            variant="error"
          />
        </Suspense>
      )}
    </div>
  )
}
