import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/app/components/layout/AppLayout'
import { Home } from '@/app/components/pages/Home'
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
  AchievementsPage,
  DEFAULT_ACHIEVEMENTS_STATE,
  DEFAULT_ACHIEVEMENTS_CACHES,
  type AchievementsPageState,
  type AchievementsPageCaches,
} from '@/app/components/pages/AchievementsPage'
import { MapDetailPage } from '@/app/components/pages/MapDetailPage'
import { PlayerDetailPage } from '@/app/components/pages/PlayerDetailPage'
import { CapDetailPage } from '@/app/components/pages/CapDetailPage'
import { InstallationBanner } from '@/app/components/InstallationBanner'
import { UpdateBanner } from '@/app/components/updater/UpdateBanner'
import { FavoritesSyncModal } from '@/app/components/shared/FavoritesSyncModal'
import { PatreonModal } from '@/app/components/modals/PatreonModal'
import type { ServerPreset } from '@/app/utils/server-utils'
import { useFavorites } from '@/app/hooks/useFavorites'
import { loadPatreonMembers } from '@/app/utils/patreon'
import { fetchAchievementDefinitions, fetchMyAchievements } from '@/app/utils/api'


const MAPS_STATE_STORAGE_KEY = 'utbt:mapsPageState:v1'
const SERVERS_STATE_STORAGE_KEY = 'utbt:serversState:v1'
const PLAYERS_STATE_STORAGE_KEY = 'utbt:playersState:v1'
const CAP_IT_ALL_STATE_STORAGE_KEY = 'utbt:capItAllState:v1'
const ACHIEVEMENTS_STATE_STORAGE_KEY = 'utbt:achievementsState:v1'
const SERVER_PRESETS_STORAGE_KEY = 'utbt:serverPresets:v1'
const SERVER_FAVORITES_STORAGE_KEY = 'utbt:serverFavorites:v2'

const SINGLE_TO_MULTI_FILTER_KEYS: Array<[string, string]> = [
  ['authorFilter', 'authorFilters'],
  ['tagFilter', 'tagFilters'],
  ['yearFilter', 'yearFilters'],
  ['difficultyFilter', 'difficultyFilters'],
  ['ratingFilter', 'ratingFilters'],
  ['aestheticsFilter', 'aestheticsFilters'],
  ['learningFilter', 'learningFilters'],
  ['luckFilter', 'luckFilters'],
  ['recordTimeFilter', 'recordTimeFilters'],
  ['cappedFilter', 'cappedFilters'],
]

function migrateSingleToMulti(parsed: any): void {
  if (!parsed || typeof parsed !== 'object') return
  for (const [oldKey, newKey] of SINGLE_TO_MULTI_FILTER_KEYS) {
    if (oldKey in parsed && !(newKey in parsed)) {
      const v = parsed[oldKey]
      parsed[newKey] = v && v !== 'all' ? [v] : []
      delete parsed[oldKey]
    }
  }
}

function loadPersistedMapsState(): MapsPageState {
  if (typeof window === 'undefined') return DEFAULT_MAPS_STATE
  try {
    const raw = window.localStorage.getItem(MAPS_STATE_STORAGE_KEY)
    if (!raw) return DEFAULT_MAPS_STATE
    const parsed = JSON.parse(raw)
    migrateSingleToMulti(parsed)
    // Merge over defaults so any newly-added state keys still get sane values.
    return { ...DEFAULT_MAPS_STATE, ...parsed, scrollTop: 0 }
  } catch {
    return DEFAULT_MAPS_STATE
  }
}

function loadPersistedServersState(): ServerBrowserState {
  if (typeof window === 'undefined') return DEFAULT_SERVERS_STATE
  try {
    const raw = window.localStorage.getItem(SERVERS_STATE_STORAGE_KEY)
    if (!raw) return DEFAULT_SERVERS_STATE
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_SERVERS_STATE,
      ...parsed,
      filters: { ...DEFAULT_SERVERS_STATE.filters, ...(parsed?.filters ?? {}) },
      columnVisibility: {
        ...DEFAULT_SERVERS_STATE.columnVisibility,
        ...(parsed?.columnVisibility ?? {}),
      },
      columnOrder: Array.isArray(parsed?.columnOrder) && parsed.columnOrder.length > 0
        ? parsed.columnOrder
        : DEFAULT_SERVERS_STATE.columnOrder,
      scrollTop: 0,
    }
  } catch {
    return DEFAULT_SERVERS_STATE
  }
}

function loadPersistedPlayersState(): PlayersPageState {
  if (typeof window === 'undefined') return DEFAULT_PLAYERS_STATE
  try {
    const raw = window.localStorage.getItem(PLAYERS_STATE_STORAGE_KEY)
    if (!raw) return DEFAULT_PLAYERS_STATE
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_PLAYERS_STATE,
      ...parsed,
      columnVisibility: {
        ...DEFAULT_PLAYERS_STATE.columnVisibility,
        ...(parsed?.columnVisibility ?? {}),
      },
      columnOrder: Array.isArray(parsed?.columnOrder) && parsed.columnOrder.length > 0
        ? parsed.columnOrder
        : DEFAULT_PLAYERS_STATE.columnOrder,
      scrollTop: 0,
    }
  } catch {
    return DEFAULT_PLAYERS_STATE
  }
}

function loadPersistedCapItAllState(): CapItAllPageState {
  if (typeof window === 'undefined') return DEFAULT_CAP_IT_ALL_STATE
  try {
    const raw = window.localStorage.getItem(CAP_IT_ALL_STATE_STORAGE_KEY)
    if (!raw) return DEFAULT_CAP_IT_ALL_STATE
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_CAP_IT_ALL_STATE,
      ...parsed,
      scrollTop: 0,
    }
  } catch {
    return DEFAULT_CAP_IT_ALL_STATE
  }
}

function loadPersistedAchievementsState(): AchievementsPageState {
  if (typeof window === 'undefined') return DEFAULT_ACHIEVEMENTS_STATE
  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_STATE_STORAGE_KEY)
    if (!raw) return DEFAULT_ACHIEVEMENTS_STATE
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_ACHIEVEMENTS_STATE, ...parsed, scrollTop: 0 }
  } catch {
    return DEFAULT_ACHIEVEMENTS_STATE
  }
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
  const [currentView, setCurrentView] = useState('home')
  const [selectedMapName, setSelectedMapName] = useState<string | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | number | null>(null)
  const [selectedCapId, setSelectedCapId] = useState<string | null>(null)
  const [previousView, setPreviousView] = useState<string>('home')
  const [installationStatus, setInstallationStatus] = useState<'valid' | 'no-install' | 'unsupported' | null>(null)
  const [mapsState, setMapsState] = useState<MapsPageState>(loadPersistedMapsState)
  const [mapsCaches, setMapsCaches] = useState<MapsPageCaches>(DEFAULT_MAPS_CACHES)
  const [serversState, setServersState] = useState<ServerBrowserState>(loadPersistedServersState)
  const [serversCaches, setServersCaches] = useState<ServerBrowserCaches>(DEFAULT_SERVERS_CACHES)
  const [playersState, setPlayersState] = useState<PlayersPageState>(loadPersistedPlayersState)
  const [playersCaches, setPlayersCaches] = useState<PlayersPageCaches>(DEFAULT_PLAYERS_CACHES)
  const [capItAllState, setCapItAllState] = useState<CapItAllPageState>(loadPersistedCapItAllState)
  const [capItAllCaches, setCapItAllCaches] = useState<CapItAllPageCaches>(DEFAULT_CAP_IT_ALL_CACHES)
  const [achievementsState, setAchievementsState] = useState<AchievementsPageState>(loadPersistedAchievementsState)
  const [achievementsCaches, setAchievementsCaches] = useState<AchievementsPageCaches>(DEFAULT_ACHIEVEMENTS_CACHES)
  const [serverPresets, setServerPresets] = useState<ServerPreset[]>(loadPersistedServerPresets)
  const [favoriteServerIds, setFavoriteServerIds] = useState<Set<string>>(loadPersistedServerFavorites)

  useEffect(() => {
    void loadPatreonMembers()
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(MAPS_STATE_STORAGE_KEY, JSON.stringify(mapsState))
    } catch {
      // localStorage may be full or unavailable; swallow.
    }
  }, [mapsState])

  useEffect(() => {
    try {
      window.localStorage.setItem(SERVERS_STATE_STORAGE_KEY, JSON.stringify(serversState))
    } catch { /* ignore */ }
  }, [serversState])

  useEffect(() => {
    try {
      window.localStorage.setItem(PLAYERS_STATE_STORAGE_KEY, JSON.stringify(playersState))
    } catch { /* ignore */ }
  }, [playersState])

  useEffect(() => {
    try {
      window.localStorage.setItem(CAP_IT_ALL_STATE_STORAGE_KEY, JSON.stringify(capItAllState))
    } catch { /* ignore */ }
  }, [capItAllState])

  useEffect(() => {
    try {
      window.localStorage.setItem(ACHIEVEMENTS_STATE_STORAGE_KEY, JSON.stringify(achievementsState))
    } catch { /* ignore */ }
  }, [achievementsState])

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

  // Single source of truth for map favorites. See app/hooks/useFavorites.ts.
  const {
    favoriteMapNames,
    toggle: toggleFavorite,
    syncModal,
    resolveSync,
    dismissSync,
  } = useFavorites(accessToken, userId)

  useEffect(() => {
    const onOpenPlayer = (e: Event) => {
      const ce = e as CustomEvent<{ userId: string | number }>
      if (ce.detail?.userId == null) return
      setSelectedPlayerId(ce.detail.userId)
      setPreviousView(prev => currentView === 'player-detail' ? prev : currentView)
      setCurrentView('player-detail')
    }
    window.addEventListener('open-player', onOpenPlayer as EventListener)
    return () => window.removeEventListener('open-player', onOpenPlayer as EventListener)
  }, [currentView])

  useEffect(() => {
    const onOpenCap = (e: Event) => {
      const ce = e as CustomEvent<{ capId: string }>
      if (!ce.detail?.capId) return
      setSelectedCapId(ce.detail.capId)
      setPreviousView(prev => currentView === 'cap-detail' ? prev : currentView)
      setCurrentView('cap-detail')
    }
    window.addEventListener('open-cap', onOpenCap as EventListener)
    return () => window.removeEventListener('open-cap', onOpenCap as EventListener)
  }, [currentView])

  // Stamp achievements + grant earned titles on launcher load, even if the user
  // never opens the Achievements page. GET /me stamps server-side and is
  // idempotent (unique constraint + existing-set check), so it's safe to fire on
  // every sign-in. Also warms the cache so the page opens instantly.
  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    void (async () => {
      try {
        const [definitions, mine] = await Promise.all([
          fetchAchievementDefinitions(accessToken),
          fetchMyAchievements(accessToken),
        ])
        if (cancelled) return
        setAchievementsCaches(prev => ({
          ...prev,
          definitions,
          progress: mine.items,
          lastRefreshIso: new Date().toISOString(),
        }))
      } catch (e) {
        console.error('Achievement stamp-on-load failed:', e)
      }
    })()
    return () => { cancelled = true }
  }, [accessToken])

  const openMap = useCallback((name: string) => {
    setPreviousView(prev => currentView === 'maps-detail' ? prev : currentView)
    setSelectedMapName(name)
    setCurrentView('maps-detail')
  }, [currentView])

  const goBack = useCallback(() => {
    setCurrentView(view =>
      view === 'maps-detail' || view === 'player-detail' || view === 'cap-detail' ? previousView : view
    )
  }, [previousView])

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault()
        goBack()
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [goBack])

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
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
          onMapSelect={openMap}
          onViewServers={() => setCurrentView('servers')}
          onViewMaps={() => setCurrentView('maps')}
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
      case 'achievements':
        return <AchievementsPage
          userProfile={userProfile as any}
          state={achievementsState}
          onStateChange={setAchievementsState}
          caches={achievementsCaches}
          onCachesChange={setAchievementsCaches}
        />
      case 'maps-detail':
        return <MapDetailPage
          mapName={selectedMapName!}
          onBack={goBack}
          userProfile={userProfile as any}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
          onMapSelect={openMap}
        />
      case 'player-detail':
        return <PlayerDetailPage
          userId={selectedPlayerId!}
          onBack={goBack}
          userProfile={userProfile as any}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
          onMapSelect={openMap}
        />
      case 'cap-detail':
        // key on capId so clicking a different time re-mounts the page fresh
        // (no stale compare/detail state carried between caps).
        return <CapDetailPage
          key={selectedCapId!}
          capId={selectedCapId!}
          onBack={goBack}
          userProfile={userProfile as any}
          onMapSelect={openMap}
        />
      default:
        return <Home
          userProfile={userProfile as any}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
          onMapSelect={openMap}
          onViewServers={() => setCurrentView('servers')}
          onViewMaps={() => setCurrentView('maps')}
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
        <AppLayout currentView={currentView} onViewChange={setCurrentView} userProfile={userProfile} installationStatus={installationStatus}>
          {renderView()}
        </AppLayout>
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
