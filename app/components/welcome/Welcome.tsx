import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import './styles.css'
import { Button } from '@/app/components/ui/button'
import { UpdateModal } from '@/app/components/welcome/UpdateModal'
import logo from '@/app/assets/logo.png'
import { useConveyor } from '@/app/hooks/use-conveyor'

export default function Welcome({ onInstall }: { onInstall?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const app = useConveyor('app')
  const [currentVersion, setCurrentVersion] = useState<string | undefined>(undefined)
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false)
  const [pendingManifest, setPendingManifest] = useState<{ asset_url: string; sha256: string; tag: string; channel: 'stable' | 'rc'; release_notes_url?: string } | null>(null)
  const [updating, setUpdating] = useState<boolean>(false)
  const [updateProgress, setUpdateProgress] = useState<number>(0)
  const [updateText, setUpdateText] = useState<string>('')
  const [forceUpdate, setForceUpdate] = useState<boolean>(false)


  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty('--parallax-x', String(x * 30))
    el.style.setProperty('--parallax-y', String(y * 30))
  }

  // Check for updates on startup
  useEffect(() => {
    const run = async () => {
      const install = await app.getInstallPath()
      if (install) {
        try {
          const installed = await app.getInstalledPatch()
          if (installed?.tag) {
            setCurrentVersion(installed.tag)
          } else {
            const base = await app.getBaseVersion()
            setCurrentVersion(base)
          }
        } catch (err) {
          console.warn('Failed to resolve current version from installed patch/base version', err)
        }
        try {
          const manifestResp = await app.fetchLatestPatchManifest(undefined)
          if (manifestResp?.success && manifestResp.data) {
            const installed = await app.getInstalledPatch()
            const needsPatch = !installed || installed.tag !== manifestResp.data.tag
            if (needsPatch) {
              setPendingManifest({
                asset_url: manifestResp.data.asset_url,
                sha256: manifestResp.data.sha256,
                tag: manifestResp.data.tag,
                channel: (manifestResp.data.channel as 'stable' | 'rc') || 'stable',
                release_notes_url: manifestResp.data.release_notes_url,
              })
              setForceUpdate(!installed)
              setShowUpdateModal(true)
            }
          }
        } catch {
          // ignore errors in startup check
        }
      }
    }
    run()
  }, [app])

  useEffect(() => {
    window.utInstall.onProgress((data) => {
      if (data.stage === 'patch' && typeof data.progress === 'number') {
        setUpdateProgress(data.progress)
        setUpdateText(`Downloading Latest Patch (${data.progress}%)`)
      }
    })
    window.utPatch.onStatus((data) => {
      if (data.status === 'downloading') setUpdateText('Downloading Latest Patch…')
      if (data.status === 'verifying') setUpdateText('Verifying Patch…')
      if (data.status === 'applying') setUpdateText('Applying Patch…')
      if (data.status === 'complete') {
        setUpdateText('Latest Patch Applied')
        setUpdateProgress(100)
        setUpdating(false)
        setShowUpdateModal(false)
      }
      if (data.status === 'error') {
        setUpdateText('Patch Update Failed')
        setUpdating(false)
      }
    })
  }, [])

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} className="welcome-container">
      <div className="nebula-bg" aria-hidden="true" />
      <motion.div
        className="welcome-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.img
          src={logo}
          alt="UTBT.net Logo"
          className="logo"
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
        <div className="actions">
          <Button onClick={onInstall}>Install Unreal Tournament 1999</Button>
        </div>
      </motion.div>

      {showUpdateModal && pendingManifest && (
        <UpdateModal
          pendingManifest={pendingManifest}
          updating={updating}
          updateProgress={updateProgress}
          updateText={updateText}
          currentVersion={currentVersion}
          force={forceUpdate}
          onClose={() => setShowUpdateModal(false)}
          onUpdate={async () => {
            if (!pendingManifest) return
            setUpdating(true)
            setUpdateProgress(0)
            setUpdateText('Starting…')
            try {
              await app.applyPatchFromManifest(pendingManifest)
            } catch {
              setUpdating(false)
            }
          }}
        />
      )}
    </div>
  )
}