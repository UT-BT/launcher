import { useEffect, useState } from 'react'
import { useWindowContext } from './WindowContext'
import { useConveyor } from '@/app/hooks/use-conveyor'
import { LinksDropdown } from './LinksDropdown'
import { AboutButton } from './AboutButton'
import { UploadLogButton } from './UploadLogButton'
import { GameProfilesButton } from './GameProfilesButton'
import { TitlebarMenuItem } from './TitlebarMenu'
import { FaMinus, FaSquare, FaTimes, FaWindowRestore } from 'react-icons/fa'

export const Titlebar = () => {
  const { icon } = useWindowContext().titlebar
  const { window: wcontext } = useWindowContext()

  return (
    <div className={`window-titlebar modern-titlebar ${wcontext?.platform ? `platform-${wcontext.platform}` : ''}`}>
      <div className="window-titlebar-center-icon">
        <img src={icon} alt="UTBT" />
        <span className="window-titlebar-brand-text">UTBT.net</span>
      </div>

      <div className="window-titlebar-actions">
        <LinksDropdown />
        <AboutButton />
        <div className="titlebar-separator" />
        <GameProfilesButton />
        <UploadLogButton />
      </div>

      {wcontext?.platform === 'win32' && <TitlebarControls />}
    </div>
  )
}

const TitlebarControls = () => {
  const { window: wcontext } = useWindowContext()
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const checkMaximized = () => {
      const isMax = window.innerWidth === screen.availWidth && window.innerHeight === screen.availHeight
      setIsMaximized(isMax)
    }
    checkMaximized()

    window.addEventListener('resize', checkMaximized)
    return () => window.removeEventListener('resize', checkMaximized)
  }, [])

  return (
    <div className="window-titlebar-controls">
      {wcontext?.minimizable && <TitlebarControlButton label="minimize" icon={FaMinus} />}
      {wcontext?.maximizable && (
        <TitlebarControlButton
          label="maximize"
          icon={isMaximized ? FaWindowRestore : FaSquare}
        />
      )}
      <TitlebarControlButton label="close" icon={FaTimes} />
    </div>
  )
}

const TitlebarControlButton = ({ icon: Icon, label }: { icon: React.ComponentType; label: string }) => {
  const { windowMinimize, windowMaximizeToggle, windowClose } = useConveyor('window')

  const handleAction = () => {
    const actions = {
      minimize: windowMinimize,
      maximize: windowMaximizeToggle,
      close: windowClose,
    }
    actions[label as keyof typeof actions]?.()
  }

  return (
    <div aria-label={label} className="titlebar-controlButton" onClick={handleAction}>
      <Icon />
    </div>
  )
}

export interface TitlebarProps {
  title: string
  titleCentered?: boolean
  icon?: string
  menuItems?: TitlebarMenuItem[]
}