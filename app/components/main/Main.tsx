import { useState, useEffect } from 'react'
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

export function Main({ userProfile }: { userProfile?: import('@/lib/main/config').AuthConfig }) {
  const [currentView, setCurrentView] = useState('home')
  const [selectedMapName, setSelectedMapName] = useState<string | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | number | null>(null)
  const [previousView, setPreviousView] = useState<string>('home')
  const [installationStatus, setInstallationStatus] = useState<'valid' | 'no-install' | 'unsupported' | null>(null)
  const [mapsState, setMapsState] = useState<MapsPageState>(loadPersistedMapsState)
  const [mapsCaches, setMapsCaches] = useState<MapsPageCaches>(DEFAULT_MAPS_CACHES)

  useEffect(() => {
    try {
      window.localStorage.setItem(MAPS_STATE_STORAGE_KEY, JSON.stringify(mapsState))
    } catch {
      // localStorage may be full or unavailable; swallow.
    }
  }, [mapsState])

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
        return <Home userProfile={userProfile as any} />
      case 'servers':
        return <ServerBrowserPage installationStatus={installationStatus} />
      case 'maps':
        return <MapsPage
          userProfile={userProfile as any}
          state={mapsState}
          onStateChange={setMapsState}
          caches={mapsCaches}
          onCachesChange={setMapsCaches}
          onMapSelect={(name) => { setSelectedMapName(name); setCurrentView('maps-detail') }}
        />
      case 'maps-detail':
        return <MapDetailPage
          mapName={selectedMapName!}
          onBack={() => setCurrentView('maps')}
          userProfile={userProfile as any}
        />
      case 'player-detail':
        return <PlayerDetailPage
          userId={selectedPlayerId!}
          onBack={() => setCurrentView(previousView)}
          userProfile={userProfile as any}
        />
      default:
        return <Home userProfile={userProfile as any} />
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
    </div>
  )
}
