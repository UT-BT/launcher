import { createContext, useContext, useEffect, useState } from 'react'
import { AppInfo } from './AppInfo'

interface TitlebarContextProps {
  activeMenuIndex: number | null
  menusVisible: boolean
  showAppInfo: boolean
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
  const closeActiveMenu = () => setActiveMenuIndex(null)
  const toggleAppInfo = () => setShowAppInfo(prev => !prev)

  useEffect(() => {
    const contextElement = document.getElementById('titlebar-context')
    if (contextElement) {
      const handleToggleAppInfo = () => toggleAppInfo()
      contextElement.addEventListener('toggle-app-info', handleToggleAppInfo)
      return () => {
        contextElement.removeEventListener('toggle-app-info', handleToggleAppInfo)
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