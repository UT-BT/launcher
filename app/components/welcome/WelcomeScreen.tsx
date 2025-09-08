import { useRef, useState, useEffect, useCallback } from 'react'
import { useUpdates } from '@/app/hooks/useUpdates'
import { useLogger } from '@/app/hooks/use-logger'
import { UpdateModal } from './UpdateModal'
import logo from '@/app/assets/logo.png'
import type { PatchManifest } from '@/app/types'

interface SplashScreenProps {
  onReady: () => void
}

export function SplashScreen({ onReady }: SplashScreenProps) {
  const logger = useLogger('Splash')
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  const { updateState, applyUpdate, openReleaseNotes, dismissUpdate } = useUpdates()
  const [phase, setPhase] = useState<'checking' | 'animating' | 'complete'>('checking')
  const [installPathValid, setInstallPathValid] = useState<boolean | null>(null)
  const exitDelayRef = useRef<number | null>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--parallax-x', String(x * 30))
    el.style.setProperty('--parallax-y', String(y * 30))
  }

  const runInstallationChecks = useCallback(async () => {
    try {
      logger.info('Running installation validation checks')
      const installPath = await window.conveyor.app.getInstallPath()
      logger.debug('Retrieved install path', { installPath })

      if (!installPath) {
        logger.warn('No install path configured')
        setInstallPathValid(false)
        return false
      }

      const isValid = await window.conveyor.app.verifyInstallPath(installPath)
      logger.debug('Install path validation result', { installPath, isValid })
      setInstallPathValid(isValid)

      if (isValid) {
        logger.info('Installation validation passed')
      } else {
        logger.warn('Installation path is invalid', { installPath })
      }

      return isValid
    } catch (error) {
      logger.error('Installation check failed', { error })
      setInstallPathValid(false)
      return false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = async (chosen?: PatchManifest) => {
    const manifest = chosen ?? updateState.manifest
    if (!manifest) {
      logger.warn('Update attempted but no manifest available')
      return
    }

    logger.info('Starting update process', { tag: manifest.tag, channel: manifest.channel })
    try {
      await applyUpdate(manifest)
      logger.info('Update completed successfully', { tag: manifest.tag })
    } catch (error) {
      logger.error('Update failed', { error, tag: manifest.tag })
    }
  }

  const startExitAnimation = useCallback(() => {
    logger.info('Starting splash screen exit animation')
    setPhase('animating')
    setTimeout(() => {
      setPhase('complete')
      logger.info('Splash screen animation complete, calling onReady')
      onReady()
    }, 2400)
  }, [onReady]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mountedRef.current) {
      logger.info('WelcomeScreen mounted, initializing checks')
      mountedRef.current = true

      const runChecks = async () => {
        const installValid = await runInstallationChecks()
        if (!installValid) {
          logger.info('Installation invalid, staying on splash screen')
          return
        }

        logger.debug('Installation valid; evaluating update state before exit', {
          updating: updateState.updating,
          forced: updateState.forced,
          available: updateState.available
        })
      }

      runChecks()
    }
  }, [runInstallationChecks, startExitAnimation, updateState.updating, updateState.forced, updateState.available]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (installPathValid !== true) {
      if (exitDelayRef.current) {
        clearTimeout(exitDelayRef.current)
        exitDelayRef.current = null
      }
      return
    }

    if (updateState.updating || updateState.forced || updateState.available) {
      if (exitDelayRef.current) {
        clearTimeout(exitDelayRef.current)
        exitDelayRef.current = null
      }
      logger.info('Update available/in progress/forced, staying on splash screen')
      return
    }

    if (!exitDelayRef.current && phase === 'checking') {
      logger.info('No update in progress, scheduling exit animation')
      exitDelayRef.current = window.setTimeout(() => {
        startExitAnimation()
        exitDelayRef.current = null
      }, 2000)
    }

    return () => {
      if (exitDelayRef.current) {
        clearTimeout(exitDelayRef.current)
        exitDelayRef.current = null
      }
    }
  }, [installPathValid, updateState.updating, updateState.forced, updateState.available, phase, startExitAnimation]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (installPathValid === true && 
        !updateState.updating && 
        !updateState.forced && 
        !updateState.available && 
        phase === 'checking' && 
        !exitDelayRef.current) {
      logger.info('Update completed or no update needed, starting exit animation')
      startExitAnimation()
    }
  }, [installPathValid, updateState.updating, updateState.forced, updateState.available, phase, startExitAnimation]) // eslint-disable-line react-hooks/exhaustive-deps

  const getStatusText = () => {
    if (installPathValid === null) {
      return "Checking UT99 installation..."
    }
    if (installPathValid === false) {
      return "UT99 installation not found"
    }
    if (updateState.updating) {
      return "Updating launcher..."
    }
    return ""
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`page-container splash-container ${phase === 'animating' ? 'splash-animating' : ''} ${phase === 'complete' ? 'splash-complete' : ''}`}
    >
      <div className="nebula-bg" aria-hidden="true" />

      <div className="page-content">
        <img
          src={logo}
          alt="UTBT.net Logo"
          className="app-logo splash-logo parallax"
          draggable="false"
        />

        <h1 className="gradient-title splash-title">Welcome to UTBT</h1>
        {getStatusText() && (
          <p className={`subtitle splash-status`}>{getStatusText()}</p>
        )}
      </div>

        {updateState.available && updateState.manifest && (
          <UpdateModal
            manifest={updateState.manifest}
            updating={updateState.updating}
            updateProgress={updateState.progress}
            updateText={updateState.progressText}
            currentVersion={updateState.currentVersion}
            forced={updateState.forced}
            unsupportedBase={updateState.unsupportedBase}
            onClose={dismissUpdate}
            onUpdate={handleUpdate}
            onViewReleaseNotes={() => openReleaseNotes(updateState.manifest?.release_notes_url)}
          />
        )}
    </div>
  )
}
