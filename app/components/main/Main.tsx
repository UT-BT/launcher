import { useState, useEffect, useCallback, useRef } from 'react'
import { AppLayout } from '@/app/components/layout/AppLayout'
import { Home } from '@/app/components/pages/Home'
import { ServerBrowserPage } from '@/app/components/pages/ServerBrowserPage'
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
import { FavoritesSyncModal, type SyncResolution } from '@/app/components/shared/FavoritesSyncModal'
import {
  addFavoriteMap,
  fetchUserFavorites,
  removeFavoriteMap,
  replaceFavoriteMaps,
} from '@/app/utils/api'


const MAPS_STATE_STORAGE_KEY = 'utbt:mapsPageState:v1'

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

export function Main({ userProfile }: { userProfile?: import('@/app/utils/api').UserProfile }) {
  const [currentView, setCurrentView] = useState('home')
  const [selectedMapName, setSelectedMapName] = useState<string | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | number | null>(null)
  const [previousView, setPreviousView] = useState<string>('home')
  const [installationStatus, setInstallationStatus] = useState<'valid' | 'no-install' | 'unsupported' | null>(null)
  const [mapsState, setMapsState] = useState<MapsPageState>(loadPersistedMapsState)
  const [mapsCaches, setMapsCaches] = useState<MapsPageCaches>(DEFAULT_MAPS_CACHES)
  const [favoriteMapNames, setFavoriteMapNames] = useState<Set<string>>(() => new Set())
  const favoriteOrderRef = useRef<string[]>([])
  const [syncModalState, setSyncModalState] = useState<{ open: boolean; db: string[]; ini: string[] }>({
    open: false,
    db: [],
    ini: [],
  })
  const startupSyncCheckedRef = useRef(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(MAPS_STATE_STORAGE_KEY, JSON.stringify(mapsState))
    } catch {
      // localStorage may be full or unavailable; swallow.
    }
  }, [mapsState])

  const accessToken = userProfile?.accessToken
  const userId = userProfile?.id ?? undefined

  const writeIniBestEffort = useCallback(async (mapNames: string[]) => {
    try {
      await window.conveyor.favorites.writeIni(mapNames)
    } catch (err) {
      console.warn('writeIni failed (ignored)', err)
    }
  }, [])

  const applyFavorites = useCallback((names: string[]) => {
    favoriteOrderRef.current = names.slice()
    setFavoriteMapNames(new Set(names))
  }, [])

  // Initial load + startup sync diff check.
  useEffect(() => {
    let cancelled = false
    if (!accessToken || !userId) {
      favoriteOrderRef.current = []
      setFavoriteMapNames(new Set())
      startupSyncCheckedRef.current = false
      return
    }
    ;(async () => {
      try {
        const dbNames = await fetchUserFavorites(accessToken, userId)
        if (cancelled) return
        applyFavorites(dbNames)

        if (startupSyncCheckedRef.current) return
        const ini = await window.conveyor.favorites.readIni()
        if (cancelled) return
        if (!ini.ok) {
          // No valid install — nothing to sync against.
          startupSyncCheckedRef.current = true
          return
        }
        startupSyncCheckedRef.current = true

        const dbSet = new Set(dbNames)
        const iniSet = new Set(ini.mapNames)
        const sameSize = dbSet.size === iniSet.size
        const sameContents = sameSize && [...dbSet].every((n) => iniSet.has(n))
        if (sameContents) return

        setSyncModalState({ open: true, db: dbNames, ini: ini.mapNames })
      } catch (err) {
        console.error('Failed to load / sync favorites', err)
      }
    })()
    return () => { cancelled = true }
  }, [accessToken, userId, applyFavorites])

  const toggleFavorite = useCallback(async (mapName: string) => {
    if (!accessToken) return
    const wasFavorited = favoriteOrderRef.current.includes(mapName)
    const nextOrder = wasFavorited
      ? favoriteOrderRef.current.filter((n) => n !== mapName)
      : [...favoriteOrderRef.current, mapName]
    applyFavorites(nextOrder)

    try {
      if (wasFavorited) {
        await removeFavoriteMap(accessToken, mapName)
      } else {
        await addFavoriteMap(accessToken, mapName)
      }
      // Keep ini in lockstep so an out-of-launcher game start picks up the change.
      void writeIniBestEffort(nextOrder)
    } catch (err) {
      console.error('Favorite toggle failed; rolling back', err)
      applyFavorites(
        wasFavorited
          ? [...favoriteOrderRef.current, mapName]
          : favoriteOrderRef.current.filter((n) => n !== mapName),
      )
    }
  }, [accessToken, applyFavorites, writeIniBestEffort])

  // Game-close: read ini → replace DB favorites → refresh local cache.
  useEffect(() => {
    if (!accessToken) return
    const remove = window.utFavorites?.onGameClosed(async () => {
      try {
        const ini = await window.conveyor.favorites.readIni()
        if (!ini.ok) return
        const updated = await replaceFavoriteMaps(accessToken, ini.mapNames)
        applyFavorites(updated)
      } catch (err) {
        console.error('Failed to sync favorites from ini after game close', err)
      }
    })
    return () => { remove?.() }
  }, [accessToken, applyFavorites])

  const handleSyncResolve = useCallback(async (resolution: SyncResolution) => {
    if (!accessToken) return
    const { db, ini } = syncModalState
    let result: string[] = []
    try {
      if (resolution === 'db-wins') {
        await writeIniBestEffort(db)
        result = db
      } else if (resolution === 'ini-wins') {
        const updated = await replaceFavoriteMaps(accessToken, ini)
        result = updated
        await writeIniBestEffort(updated)
      } else {
        // merge — union, preserving db order then any ini-only entries
        const merged: string[] = [...db]
        const seen = new Set(db)
        for (const name of ini) {
          if (!seen.has(name)) {
            seen.add(name)
            merged.push(name)
          }
        }
        const updated = await replaceFavoriteMaps(accessToken, merged)
        result = updated
        await writeIniBestEffort(updated)
      }
      applyFavorites(result)
    } catch (err) {
      console.error('Sync resolution failed', err)
    } finally {
      setSyncModalState({ open: false, db: [], ini: [] })
    }
  }, [accessToken, syncModalState, applyFavorites, writeIniBestEffort])

  const dismissSyncModal = useCallback(() => {
    setSyncModalState({ open: false, db: [], ini: [] })
  }, [])

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
        />
      case 'servers':
        return <ServerBrowserPage
          installationStatus={installationStatus}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
        />
      case 'maps':
        return <MapsPage
          userProfile={userProfile as any}
          state={mapsState}
          onStateChange={setMapsState}
          caches={mapsCaches}
          onCachesChange={setMapsCaches}
          onMapSelect={(name) => { setSelectedMapName(name); setCurrentView('maps-detail') }}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
        />
      case 'maps-detail':
        return <MapDetailPage
          mapName={selectedMapName!}
          onBack={() => setCurrentView('maps')}
          userProfile={userProfile as any}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
        />
      case 'player-detail':
        return <PlayerDetailPage
          userId={selectedPlayerId!}
          onBack={() => setCurrentView(previousView)}
          userProfile={userProfile as any}
        />
      default:
        return <Home
          userProfile={userProfile as any}
          favoriteMapNames={favoriteMapNames}
          onToggleFavorite={toggleFavorite}
        />
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
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
        open={syncModalState.open}
        dbFavorites={syncModalState.db}
        iniFavorites={syncModalState.ini}
        onResolve={handleSyncResolve}
        onDismiss={dismissSyncModal}
      />
    </div>
  )
}
