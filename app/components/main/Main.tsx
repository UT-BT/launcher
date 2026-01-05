import { useState, useEffect } from 'react'
import { AppLayout } from '@/app/components/layout/AppLayout'
import { Home } from '@/app/components/pages/Home'
import { ServerBrowserPage } from '@/app/components/pages/ServerBrowserPage'
import { Rankings } from '@/app/components/pages/Rankings'
import { InstallationBanner } from '@/app/components/InstallationBanner'
import { MapsPage } from '@/app/components/pages/MapsPage'
import { RecordsPage } from '@/app/components/pages/RecordsPage'
import { TitlesPage } from '@/app/components/pages/TitlesPage'
import { PlaytimePage } from '@/app/components/pages/PlaytimePage'

export function Main({ userProfile }: { userProfile?: import('@/lib/main/config').AuthConfig }) {
  const [currentView, setCurrentView] = useState('home')
  const [installationStatus, setInstallationStatus] = useState<'valid' | 'no-install' | 'unsupported' | null>(null)

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
      // case 'maps':
      //   return <MapsPage userProfile={userProfile as any} />
      // case 'records':
      //   return <RecordsPage userProfile={userProfile as any} />
      // case 'titles':
      //   return <TitlesPage userProfile={userProfile as any} />
      // case 'playtime':
      //   return <PlaytimePage userProfile={userProfile as any} />
      case 'servers':
        return <ServerBrowserPage installationStatus={installationStatus} />
      // case 'rankings':
      //   return <Rankings />
      // case 'maps': return <MapSearch /> // Replaced by MapsPage
      default:
        // Default to Home if unknown view or fallback
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
