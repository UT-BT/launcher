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
import { MapDetailPage } from '@/app/components/pages/MapDetailPage'
import { PlayerDetailPage } from '@/app/components/pages/PlayerDetailPage'
import { InstallationBanner } from '@/app/components/InstallationBanner'
import { UpdateBanner } from '@/app/components/updater/UpdateBanner'
import { FavoritesSyncModal } from '@/app/components/shared/FavoritesSyncModal'
import type { ServerPreset } from '@/app/utils/server-utils'
import { useFavorites } from '@/app/hooks/useFavorites'


const MAPS_STATE_STORAGE_KEY = 'utbt:mapsPageState:v1'
const SERVERS_STATE_STORAGE_KEY = 'utbt:serversState:v1'
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
  const [previousView, setPreviousView] = useState<string>('home')
  const [installationStatus, setInstallationStatus] = useState<'valid' | 'no-install' | 'unsupported' | null>(null)
  const [mapsState, setMapsState] = useState<MapsPageState>(loadPersistedMapsState)
  const [mapsCaches, setMapsCaches] = useState<MapsPageCaches>(DEFAULT_MAPS_CACHES)
  const [serversState, setServersState] = useState<ServerBrowserState>(loadPersistedServersState)
  const [serversCaches, setServersCaches] = useState<ServerBrowserCaches>(DEFAULT_SERVERS_CACHES)
  const [serverPresets, setServerPresets] = useState<ServerPreset[]>(loadPersistedServerPresets)
  const [favoriteServerIds, setFavoriteServerIds] = useState<Set<string>>(loadPersistedServerFavorites)

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

  const openMap = useCallback((name: string) => {
    setPreviousView(prev => currentView === 'maps-detail' ? prev : currentView)
    setSelectedMapName(name)
    setCurrentView('maps-detail')
  }, [currentView])

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
      case 'maps-detail':
        return <MapDetailPage
          mapName={selectedMapName!}
          onBack={() => setCurrentView(previousView)}
          userProfile={userProfile as any}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
          onMapSelect={openMap}
        />
      case 'player-detail':
        return <PlayerDetailPage
          userId={selectedPlayerId!}
          onBack={() => setCurrentView(previousView)}
          userProfile={userProfile as any}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
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
    </div>
  )
}
