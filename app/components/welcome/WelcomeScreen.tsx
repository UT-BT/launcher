import { useRef, useState, useEffect, useCallback } from 'react'
import { useUpdates } from '@/app/hooks/useUpdates'
import { UpdateModal } from './UpdateModal'
import logo from '@/app/assets/logo.png'
import type { PatchManifest } from '@/app/types'

interface SplashScreenProps {
  onReady: () => void
}

export function SplashScreen({ onReady }: SplashScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { updateState, applyUpdate, openReleaseNotes, dismissUpdate } = useUpdates()
  const [phase, setPhase] = useState<'checking' | 'animating' | 'complete'>('checking')
  const [installPathValid, setInstallPathValid] = useState<boolean | null>(null)

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
      const installPath = await window.conveyor.app.getInstallPath()
      if (!installPath) {
        setInstallPathValid(false)
        return false
      }
      const isValid = await window.conveyor.app.verifyInstallPath(installPath)
      setInstallPathValid(isValid)
      return isValid
    } catch {
      setInstallPathValid(false)
      return false
    }
  }, [])

  const handleUpdate = async (chosen?: PatchManifest) => {
    const manifest = chosen ?? updateState.manifest
    if (!manifest) return
    try {
      await applyUpdate(manifest)
    } catch (error) {
      console.error('Update failed:', error)
    }
  }

  const startExitAnimation = useCallback(() => {
    setPhase('animating')
    setTimeout(() => {
      setPhase('complete')
      onReady()
    }, 2400)
  }, [onReady])

  useEffect(() => {
    const runChecks = async () => {
      const installValid = await runInstallationChecks()
      if (!installValid) {
        return
      }

      setTimeout(() => {
        if (!updateState.updating && !updateState.forced) {
          startExitAnimation()
        }
      }, 2000)
    }

    runChecks()
  }, [runInstallationChecks, updateState.updating, updateState.forced, startExitAnimation])

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

        {updateState.available && updateState.manifest && !updateState.forced && (
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
