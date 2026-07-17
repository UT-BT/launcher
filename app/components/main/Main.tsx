import { useState, useEffect, useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from 'react'
import { AppLayout } from '@/app/components/layout/AppLayout'
import {
  NavigationContext,
  paramsEqual,
  type NavEntry,
  type NavParams,
  type NavigationContextValue,
} from '@/app/components/navigation/NavigationContext'
import { Home, DEFAULT_HOME_CACHES, type HomePageCaches } from '@/app/components/pages/Home'
import {
  ServerBrowserPage,
  DEFAULT_SERVERS_STATE,
  DEFAULT_SERVERS_CACHES,
  type ServerBrowserState,
  type ServerBrowserCaches,
} from '@/app/components/pages/ServerBrowserPage'
import {
  MapsPage,
  DEFAULT_MAPS_STATE,
  DEFAULT_MAPS_CACHES,
  type MapsPageState,
  type MapsPageCaches,
} from '@/app/components/pages/MapsPage'
import {
  PlayersPage,
  DEFAULT_PLAYERS_STATE,
  DEFAULT_PLAYERS_CACHES,
  type PlayersPageState,
  type PlayersPageCaches,
} from '@/app/components/pages/PlayersPage'
import {
  CapItAllPage,
  DEFAULT_CAP_IT_ALL_STATE,
  DEFAULT_CAP_IT_ALL_CACHES,
  type CapItAllPageState,
  type CapItAllPageCaches,
} from '@/app/components/pages/CapItAllPage'
import {
  WorldRecordsPage,
  DEFAULT_WORLD_RECORDS_STATE,
  DEFAULT_WORLD_RECORDS_CACHES,
  type WorldRecordsPageState,
  type WorldRecordsPageCaches,
} from '@/app/components/pages/WorldRecordsPage'
import {
  AchievementsPage,
  DEFAULT_ACHIEVEMENTS_STATE,
  DEFAULT_ACHIEVEMENTS_CACHES,
  type AchievementsPageState,
  type AchievementsPageCaches,
} from '@/app/components/pages/AchievementsPage'
import {
  TeamsPage,
  DEFAULT_TEAMS_STATE,
  DEFAULT_TEAMS_CACHES,
  type TeamsPageState,
  type TeamsPageCaches,
} from '@/app/components/pages/TeamsPage'
import { TeamDetailsPage } from '@/app/components/pages/teams/TeamDetailsPage'
import { MapDetailPage } from '@/app/components/pages/MapDetailPage'
import { PlayerDetailPage } from '@/app/components/pages/PlayerDetailPage'
import { CapDetailPage } from '@/app/components/pages/CapDetailPage'
import { TeamCapDetailPage } from '@/app/components/pages/TeamCapDetailPage'
import { NewsPage } from '@/app/components/pages/NewsPage'
import { NewsDetailPage } from '@/app/components/pages/NewsDetailPage'
import { AdminPage, DEFAULT_ADMIN_STATE, type AdminPageState } from '@/app/components/pages/admin/AdminPage'
import { InstallationBanner } from '@/app/components/InstallationBanner'
import { UpdateBanner } from '@/app/components/updater/UpdateBanner'
import { FavoritesSyncModal } from '@/app/components/shared/FavoritesSyncModal'
import { PatreonModal } from '@/app/components/modals/PatreonModal'
import type { ServerPreset } from '@/app/utils/server-utils'
import { useFavorites } from '@/app/hooks/useFavorites'
import { loadPatreonMembers } from '@/app/utils/patreon'
import { fetchAchievementDefinitions, fetchMyAchievements } from '@/app/utils/api'
import { writePendingHighlight, type HighlightView } from '@/app/hooks/useNewItemHighlight'
import { isStaff } from '@/app/utils/roles'


const MAPS_STATE_STORAGE_KEY = 'utbt:mapsPageState:v1'
const SERVERS_STATE_STORAGE_KEY = 'utbt:serversState:v1'
const PLAYERS_STATE_STORAGE_KEY = 'utbt:playersState:v1'
const CAP_IT_ALL_STATE_STORAGE_KEY = 'utbt:capItAllState:v1'
const WORLD_RECORDS_STATE_STORAGE_KEY = 'utbt:worldRecordsState:v1'
const ACHIEVEMENTS_STATE_STORAGE_KEY = 'utbt:achievementsState:v1'
const TEAMS_STATE_STORAGE_KEY = 'utbt:teamsState:v1'
const ADMIN_STATE_STORAGE_KEY = 'utbt:adminState:v1'
const SERVER_PRESETS_STORAGE_KEY = 'utbt:serverPresets:v1'
const SERVER_FAVORITES_STORAGE_KEY = 'utbt:serverFavorites:v2'

const HISTORY_CAP = 50

interface BadgeInfo {
  count: number
  newestIso: string | null
}

const BADGE_STORAGE_KEYS: Record<string, string> = {
  'maps': 'utbt:newMapsSeen:v1',
  'world-records': 'utbt:newRecordsSeen:v1',
}

function readSeen(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSeen(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    return
  }
}

const MAPS_PREF_KEYS: readonly (keyof MapsPageState)[] = ['filtersPanelOpen', 'pageSizePreference']
const SERVERS_PREF_KEYS: readonly (keyof ServerBrowserState)[] = ['columnVisibility', 'columnOrder', 'filtersPanelOpen']
const PLAYERS_PREF_KEYS: readonly (keyof PlayersPageState)[] = ['columnVisibility', 'columnOrder', 'pageSizePreference']
const CAP_IT_ALL_PREF_KEYS: readonly (keyof CapItAllPageState)[] = ['pageSizePreference']
const WORLD_RECORDS_PREF_KEYS: readonly (keyof WorldRecordsPageState)[] = ['columnVisibility', 'columnOrder', 'pageSizePreference', 'filtersPanelOpen']
const ACHIEVEMENTS_PREF_KEYS: readonly (keyof AchievementsPageState)[] = []
const TEAMS_PREF_KEYS: readonly (keyof TeamsPageState)[] = []
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
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SERVER_PRESETS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as ServerPreset[] : []
  } catch {
    return []
  }
}

function loadPersistedServerFavorites(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(SERVER_FAVORITES_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function Main({ userProfile }: { userProfile?: import('@/app/utils/api').UserProfile }) {
  const [entries, setEntries] = useState<NavEntry[]>(() => [{ id: 0, view: 'home', params: {}, state: {} }])
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
  const [serverPresets, setServerPresets] = useState<ServerPreset[]>(loadPersistedServerPresets)
  const [favoriteServerIds, setFavoriteServerIds] = useState<Set<string>>(loadPersistedServerFavorites)
  const achievementsInFlightRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    void loadPatreonMembers()
  }, [])

  const updateServerPresets = useCallback((next: ServerPreset[]) => {
    setServerPresets(next)
    try {
      window.localStorage.setItem(SERVER_PRESETS_STORAGE_KEY, JSON.stringify(next))
    } catch { /* ignore */ }
  }, [])

  const toggleServerFavorite = useCallback((serverId: string) => {
    setFavoriteServerIds(prev => {
      const next = new Set(prev)
      if (next.has(serverId)) next.delete(serverId)
      else next.add(serverId)
      try {
        window.localStorage.setItem(SERVER_FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch { /* ignore */ }
      return next
    })
  }, [])

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

  const [badges, setBadges] = useState<Record<string, BadgeInfo>>({})
  const [seen, setSeen] = useState<Record<string, string | null>>(() => ({
    'maps': readSeen(BADGE_STORAGE_KEYS['maps']),
    'world-records': readSeen(BADGE_STORAGE_KEYS['world-records']),
  }))
  const seenRef = useRef(seen)
  seenRef.current = seen
  const badgesRef = useRef(badges)
  badgesRef.current = badges

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { maps?: BadgeInfo; worldRecords?: BadgeInfo } | undefined
      setBadges({
        'maps': detail?.maps ?? { count: 0, newestIso: null },
        'world-records': detail?.worldRecords ?? { count: 0, newestIso: null },
      })
    }
    window.addEventListener('summary-badges', handler)
    return () => window.removeEventListener('summary-badges', handler)
  }, [])

  const badgeVisible = useCallback((view: string): boolean => {
    const b = badges[view]
    if (!b || b.count <= 0) return false
    const last = seen[view]
    if (!last) return true
    return b.newestIso != null && Date.parse(b.newestIso) > Date.parse(last)
  }, [badges, seen])

  const markViewed = useCallback((view: string) => {
    if (!BADGE_STORAGE_KEYS[view]) return
    const b = badgesRef.current[view]
    if (!b || b.count <= 0) return
    const last = seenRef.current[view]
    const visible = !last || (b.newestIso != null && Date.parse(b.newestIso) > Date.parse(last))
    if (!visible) return
    const stamp = b.newestIso ?? new Date().toISOString()
    writeSeen(BADGE_STORAGE_KEYS[view], stamp)
    setSeen(s => ({ ...s, [view]: stamp }))
    writePendingHighlight(view as HighlightView, last)
    window.dispatchEvent(new CustomEvent('highlight-new', { detail: { view, since: last } }))
  }, [])

  const navigate = useCallback((view: string, params: NavParams = {}) => {
    const { entries: cur, cursor: curIdx } = stackRef.current
    const active = cur[curIdx]
    if (active.view === view && paramsEqual(active.params, params)) return
    markViewed(view)
    let next = [...cur.slice(0, curIdx + 1), { id: nextIdRef.current++, view, params, state: {} }]
    let nextCursor = next.length - 1
    if (next.length > HISTORY_CAP) {
      const drop = next.length - HISTORY_CAP
      next = next.slice(drop)
      nextCursor -= drop
    }
    setEntries(next)
    setCursor(nextCursor)
  }, [markViewed])

  const back = useCallback(() => setCursor(c => Math.max(0, c - 1)), [])
  const forward = useCallback(() => setCursor(c => Math.min(stackRef.current.entries.length - 1, c + 1)), [])

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

  const entry = entries[cursor]
  const currentView = entry.view
  const canBack = cursor > 0
  const canForward = cursor < entries.length - 1

  const navValue = useMemo<NavigationContextValue>(() => ({
    entry, currentView, navigate, back, forward, canBack, canForward, getEntryState, setEntryState,
  }), [entry, currentView, navigate, back, forward, canBack, canForward, getEntryState, setEntryState])

  const [mapsState, setMapsState] = usePageState(MAPS_STATE_STORAGE_KEY, DEFAULT_MAPS_STATE, MAPS_PREF_KEYS, getEntryState, updateEntryState)
  const [serversState, setServersState] = usePageState(SERVERS_STATE_STORAGE_KEY, DEFAULT_SERVERS_STATE, SERVERS_PREF_KEYS, getEntryState, updateEntryState)
  const [playersState, setPlayersState] = usePageState(PLAYERS_STATE_STORAGE_KEY, DEFAULT_PLAYERS_STATE, PLAYERS_PREF_KEYS, getEntryState, updateEntryState)
  const [capItAllState, setCapItAllState] = usePageState(CAP_IT_ALL_STATE_STORAGE_KEY, DEFAULT_CAP_IT_ALL_STATE, CAP_IT_ALL_PREF_KEYS, getEntryState, updateEntryState)
  const [worldRecordsState, setWorldRecordsState] = usePageState(WORLD_RECORDS_STATE_STORAGE_KEY, DEFAULT_WORLD_RECORDS_STATE, WORLD_RECORDS_PREF_KEYS, getEntryState, updateEntryState)
  const [achievementsState, setAchievementsState] = usePageState(ACHIEVEMENTS_STATE_STORAGE_KEY, DEFAULT_ACHIEVEMENTS_STATE, ACHIEVEMENTS_PREF_KEYS, getEntryState, updateEntryState)
  const [teamsState, setTeamsState] = usePageState(TEAMS_STATE_STORAGE_KEY, DEFAULT_TEAMS_STATE, TEAMS_PREF_KEYS, getEntryState, updateEntryState)
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
  const exitTeamsToGallery = useCallback(() => {
    setTeamsCaches(prev => ({ ...prev, loaded: false }))
    navigate('teams')
  }, [navigate])

  useEffect(() => {
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
          caches={homeCaches}
          onCachesChange={setHomeCaches}
          achievementsCaches={achievementsCaches}
          onEnsureAchievements={ensureAchievements}
          onToggleFavorite={toggleFavorite}
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
          onToggleServerFavorite={toggleServerFavorite}
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
          onToggleFavorite={toggleFavorite}
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
          onToggleFavorite={toggleFavorite}
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
          onToggleFavorite={toggleFavorite}
          onMapSelect={openMap}
        />
      case 'player-detail':
        return <PlayerDetailPage
          key={entry.id}
          userId={entry.params.playerId!}
          userProfile={userProfile as any}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
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
          favoriteMapNames={favoriteMapNames}
          caches={homeCaches}
          onCachesChange={setHomeCaches}
          achievementsCaches={achievementsCaches}
          onEnsureAchievements={ensureAchievements}
          onToggleFavorite={toggleFavorite}
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
    <div className="h-screen flex flex-col overflow-hidden">
      <UpdateBanner />
      {installationStatus && installationStatus !== 'valid' && (
        <InstallationBanner
          type={installationStatus}
          onClick={() => window.dispatchEvent(new CustomEvent('open-settings', { detail: { section: 'game-installation' } }))}
        />
      )}
      <div className="flex-1 overflow-hidden">
        <NavigationContext.Provider value={navValue}>
          <AppLayout currentView={currentView} onViewChange={navigate} getNavBadge={(view) => badgeVisible(view) ? badges[view].count : null} userProfile={userProfile} installationStatus={installationStatus}>
            {renderView()}
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
    </div>
  )
}
