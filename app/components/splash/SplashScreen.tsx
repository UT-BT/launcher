import { useRef, useState, useEffect, useCallback } from 'react'
import { useLogger } from '@/app/hooks/use-logger'
import logo from '@/app/assets/logo.png'

interface SplashScreenProps {
  onReady: () => void
  variant?: 'intro' | 'error'
}

export function SplashScreen({ onReady, variant = 'intro' }: SplashScreenProps) {
  const logger = useLogger('Splash')
  const containerRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'checking' | 'animating' | 'complete'>('checking')

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--parallax-x', String(x * 30))
    el.style.setProperty('--parallax-y', String(y * 30))
  }

  const startExitAnimation = useCallback(() => {
    if (variant === 'error') return

    logger.info('Starting splash screen exit animation')
    setPhase('animating')
    setTimeout(() => {
      setPhase('complete')
      logger.info('Splash screen animation complete, calling onReady')
      onReady()
    }, 2400)
  }, [onReady, logger, variant])

  useEffect(() => {
    if (variant === 'error') {
      setPhase('checking')
      return
    }

    const timer = setTimeout(() => {
      startExitAnimation()
    }, 2000)

    return () => clearTimeout(timer)
  }, [startExitAnimation, variant])

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`page-container splash-container ${phase === 'animating' ? 'splash-animating' : ''} ${phase === 'complete' ? 'splash-complete' : ''} ${variant === 'error' ? 'splash-error' : ''}`}
    >
      <div className="nebula-bg" aria-hidden="true" />

      <div className="page-content">
        <img
          src={logo}
          alt="UTBT.net Logo"
          className={`app-logo splash-logo parallax ${variant === 'error' ? 'animate-pulse' : ''}`}
          draggable="false"
        />

        <h1 className="gradient-title splash-title">UTBT Launcher</h1>
        <span className="subtitle splash-version">Addicted to BunnyTrack</span>
      </div>
    </div>
  )
}
