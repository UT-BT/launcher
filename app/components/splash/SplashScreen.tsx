import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useLogger } from '@/app/hooks/use-logger'
import { useLogo } from '@/app/seasonal/logos'
import { useUpdater } from '@/app/hooks/useUpdater'
import { cn } from '@/lib/utils'
import { splashUpdateStatus, type SplashUpdateStatus } from './splashUpdateStatus'
import { SplashPatreonCard } from './SplashPatreonCard'

interface SplashScreenProps {
  onReady: () => void
  variant?: 'intro' | 'error'
}

const INTRO_MS = 2000

export function SplashScreen({ onReady, variant = 'intro' }: SplashScreenProps) {
  const logo = useLogo()
  const logger = useLogger('Splash')
  const containerRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'checking' | 'animating' | 'complete'>('checking')
  const [introDone, setIntroDone] = useState(false)
  const { state: updater } = useUpdater()

  const status = useMemo(
    () => splashUpdateStatus({
      holdingLaunch: updater.holdingLaunch,
      phase: updater.phase,
      version: updater.version,
      progressPercent: updater.progressPercent,
    }),
    [updater.holdingLaunch, updater.phase, updater.version, updater.progressPercent],
  )
  const [shownStatus, setShownStatus] = useState<SplashUpdateStatus | null>(null)
  const statusVisible = status !== null && (status.kind !== 'checking' || introDone)

  useEffect(() => {
    if (status && (status.kind !== 'checking' || introDone)) setShownStatus(status)
  }, [status, introDone])

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
    setIntroDone(false)
    if (variant === 'error') {
      setPhase('checking')
      return
    }

    const timer = setTimeout(() => setIntroDone(true), INTRO_MS)
    return () => clearTimeout(timer)
  }, [variant])

  useEffect(() => {
    if (phase !== 'checking' || !introDone || updater.holdingLaunch) return
    startExitAnimation()
  }, [phase, introDone, updater.holdingLaunch, startExitAnimation])

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

        <div className={cn('splash-update', statusVisible && 'is-visible')} role="status" aria-live="polite">
          {shownStatus && (
            <>
              <div className="splash-update-label">
                {shownStatus.label}
                {shownStatus.kind === 'downloading' && (
                  <span className="splash-update-percent"> · {shownStatus.percent}%</span>
                )}
              </div>
              <div className={cn('splash-update-track', shownStatus.kind !== 'downloading' && 'is-indeterminate')}>
                <div
                  className="splash-update-fill"
                  style={shownStatus.kind === 'downloading' ? { clipPath: `inset(0 ${100 - shownStatus.percent}% 0 0 round 999px)` } : undefined}
                />
              </div>
              <SplashPatreonCard active={statusVisible && status.kind !== 'checking'} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
