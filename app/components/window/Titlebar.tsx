import { useEffect, useState } from 'react'
import { useWindowContext } from './WindowContext'
import { useConveyor } from '@/app/hooks/use-conveyor'
import { LinksDropdown } from './LinksDropdown'
import { AboutButton } from './AboutButton'
import { TitlebarMenuItem } from './TitlebarMenu'

const SVG_PATHS = {
  close: 'M 0,0 0,0.7 4.3,5 0,9.3 0,10 0.7,10 5,5.7 9.3,10 10,10 10,9.3 5.7,5 10,0.7 10,0 9.3,0 5,4.3 0.7,0 Z',
  maximize: 'M 0,0 0,10 10,10 10,0 Z M 1,1 9,1 9,9 1,9 Z',
  restore: 'M 2,1 2,9 9,9 9,1 Z M 1,0 10,0 10,8 8,8 8,10 0,10 0,3 1,3 Z',
  minimize: 'M 0,5 10,5 10,6 0,6 Z',
} as const

export const Titlebar = () => {
  const { titlebar, icon } = useWindowContext().titlebar
  const { window: wcontext } = useWindowContext()

  return (
    <div className={`window-titlebar modern-titlebar ${wcontext?.platform ? `platform-${wcontext.platform}` : ''}`}>
      <div className="window-titlebar-center-icon">
        <img src={icon} alt="UTBT" />
      </div>

      <div className="window-titlebar-actions">
        <LinksDropdown />
        <AboutButton />
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
      {wcontext?.minimizable && <TitlebarControlButton label="minimize" svgPath={SVG_PATHS.minimize} />}
      {wcontext?.maximizable && (
        <TitlebarControlButton
          label="maximize"
          svgPath={isMaximized ? SVG_PATHS.restore : SVG_PATHS.maximize}
        />
      )}
      <TitlebarControlButton label="close" svgPath={SVG_PATHS.close} />
    </div>
  )
}

const TitlebarControlButton = ({ svgPath, label }: { svgPath: string; label: string }) => {
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
      <svg width="10" height="10">
        <path fill="currentColor" d={svgPath} />
      </svg>
    </div>
  )
}

export interface TitlebarProps {
  title: string
  titleCentered?: boolean
  icon?: string
  menuItems?: TitlebarMenuItem[]
}