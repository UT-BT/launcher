import { useState } from 'react'
import { AppLayout } from '@/app/components/layout/AppLayout'
import { ActivityFeed } from '@/app/components/pages/ActivityFeed'
import { ServerBrowserPage } from '@/app/components/pages/ServerBrowserPage'
import { Rankings } from '@/app/components/pages/Rankings'
import { MapSearch } from '@/app/components/pages/MapSearch'
import { Settings } from '@/app/components/pages/Settings'

export function Main() {
  const [currentView, setCurrentView] = useState('home')

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <ActivityFeed />
      case 'servers':
        return <ServerBrowserPage />
      case 'rankings':
        return <Rankings />
      case 'maps':
        return <MapSearch />
      case 'settings':
        return <Settings />
      default:
        return <ActivityFeed />
    }
  }

  return (
    <AppLayout currentView={currentView} onViewChange={setCurrentView}>
      {renderView()}
    </AppLayout>
  )
}
