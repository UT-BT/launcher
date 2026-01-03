import { useState, useEffect } from 'react'
import { AppLayout } from '@/app/components/layout/AppLayout'
import { ActivityFeed } from '@/app/components/pages/ActivityFeed'
import { ServerBrowserPage } from '@/app/components/pages/ServerBrowserPage'
import { Rankings } from '@/app/components/pages/Rankings'
import { MapSearch } from '@/app/components/pages/MapSearch'
import { Settings } from '@/app/components/pages/Settings'
import { InstallationBanner } from '@/app/components/InstallationBanner'

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

  const handleBannerClick = () => {
    setCurrentView('settings')
  }

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <ActivityFeed />
      case 'servers':
        return <ServerBrowserPage installationStatus={installationStatus} />
      case 'rankings':
        return <Rankings />
      case 'maps':
        return <MapSearch />
      case 'settings':
        return <Settings initialSection={installationStatus !== 'valid' ? 'game-installation' : undefined} />
      default:
        return <ActivityFeed />
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {installationStatus && installationStatus !== 'valid' && (
        <InstallationBanner type={installationStatus} onClick={handleBannerClick} />
      )}
      <div className="flex-1 overflow-hidden">
        <AppLayout currentView={currentView} onViewChange={setCurrentView} userProfile={userProfile}>
          {renderView()}
        </AppLayout>
      </div>
    </div>
  )
}
