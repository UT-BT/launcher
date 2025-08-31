import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/app/components/ui/button'
import { useUpdates } from '@/app/hooks/useUpdates'
import { UpdateModal } from './UpdateModal'
import logo from '@/app/assets/logo.png'

interface WelcomeScreenProps {
  onInstall?: () => void
}

export function WelcomeScreen({ onInstall }: WelcomeScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { updateState, applyUpdate, openReleaseNotes, dismissUpdate } = useUpdates()

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--parallax-x', String(x * 30))
    el.style.setProperty('--parallax-y', String(y * 30))
  }

  const handleUpdate = async () => {
    if (!updateState.manifest) return
    try {
      await applyUpdate(updateState.manifest)
    } catch (error) {
      console.error('Update failed:', error)
    }
  }

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} className="page-container">
      <div className="nebula-bg" aria-hidden="true" />
      
      <motion.div
        className="page-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.img
          src={logo}
          alt="UTBT.net Logo"
          className="app-logo parallax"
          draggable="false"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            duration: 0.5, 
            delay: 0.2,
            ease: "easeOut"
          }}
        />
        
        <motion.h1
          className="gradient-title parallax"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          Welcome to UTBT
        </motion.h1>
        
        <div className="actions-section">
          <Button onClick={onInstall} className="enhanced-button">
            Install Unreal Tournament 1999
          </Button>
        </div>
      </motion.div>

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

const parallaxStyles = `
.parallax {
  transform: translate3d(calc(var(--parallax-x, 0) * 1px), calc(var(--parallax-y, 0) * 1px), 0);
  transition: transform 0.08s linear;
}
`

if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = parallaxStyles
  document.head.appendChild(style)
}
