import { createContext, useContext, useEffect, useState } from 'react'
import { AppInfo } from './AppInfo'

interface TitlebarContextProps {
  activeMenuIndex: number | null
  menusVisible: boolean
  showAppInfo: boolean
  locked: boolean
  areButtonsDisabled: boolean
  isGameProfilesDisabled: boolean
  setActiveMenuIndex: (index: number | null) => void
  setMenusVisible: (visible: boolean) => void
  closeActiveMenu: () => void
  toggleAppInfo: () => void
}

const TitlebarContext = createContext<TitlebarContextProps | undefined>(undefined)

export const TitlebarContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null)
  const [menusVisible, setMenusVisible] = useState(true)
  const [showAppInfo, setShowAppInfo] = useState(false)
  const [locked, setLocked] = useState(false)
  const [areButtonsDisabled, setAreButtonsDisabled] = useState(true)
  const [isGameProfilesDisabled, setIsGameProfilesDisabled] = useState(true)
  const closeActiveMenu = () => setActiveMenuIndex(null)
  const toggleAppInfo = () => setShowAppInfo(prev => !prev)

  useEffect(() => {
    const contextElement = document.getElementById('titlebar-context')
    if (contextElement) {
      const handleToggleAppInfo = () => toggleAppInfo()
      const handleSetLock = (e: Event) => {
        const custom = e as CustomEvent<{ locked: boolean }>
        setLocked(Boolean(custom.detail?.locked))
      }
      const handleSetGlobalDisabled = (e: Event) => {
        const custom = e as CustomEvent<{ disabled: boolean }>
        setAreButtonsDisabled(Boolean(custom.detail?.disabled))
      }
      const handleSetGameProfilesDisabled = (e: Event) => {
        const custom = e as CustomEvent<{ disabled: boolean }>
        setIsGameProfilesDisabled(Boolean(custom.detail?.disabled))
      }

      contextElement.addEventListener('toggle-app-info', handleToggleAppInfo)
      contextElement.addEventListener('set-titlebar-lock', handleSetLock as EventListener)
      contextElement.addEventListener('set-titlebar-global-disabled', handleSetGlobalDisabled as EventListener)
      contextElement.addEventListener('set-titlebar-game-profiles-disabled', handleSetGameProfilesDisabled as EventListener)

      return () => {
        contextElement.removeEventListener('toggle-app-info', handleToggleAppInfo)
        contextElement.removeEventListener('set-titlebar-lock', handleSetLock as EventListener)
        contextElement.removeEventListener('set-titlebar-global-disabled', handleSetGlobalDisabled as EventListener)
        contextElement.removeEventListener('set-titlebar-game-profiles-disabled', handleSetGameProfilesDisabled as EventListener)
      }
    }
    return undefined
  }, [toggleAppInfo])

  return (
    <TitlebarContext.Provider
      value={{
        activeMenuIndex,
        menusVisible,
        showAppInfo,
        locked,
        areButtonsDisabled,
        isGameProfilesDisabled,
        setActiveMenuIndex,
        setMenusVisible,
        closeActiveMenu,
        toggleAppInfo
      }}
    >
      <div data-titlebar-context id="titlebar-context">
        {children}
        {showAppInfo && <AppInfo onClose={toggleAppInfo} />}
      </div>
    </TitlebarContext.Provider>
  )
}

export const useTitlebarContext = () => {
  const context = useContext(TitlebarContext)
  if (!context) {
    throw new Error('useTitlebarContext must be used within a TitlebarContextProvider')
  }
  return context
}