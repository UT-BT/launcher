import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/app/components/ui/button'
import { useConveyor } from '@/app/hooks/use-conveyor'
import logo from '@/app/assets/logo.png'
import '../styles.css'
import './Install.css'

export default function Install({ onBack }: { onBack?: () => void }) {
  const app = useConveyor('app')
  const [status, setStatus] = useState<'idle' | 'downloading' | 'installing' | 'done'>('idle')
  const [progress, setProgress] = useState<number>(0)
  const [_progressCd1, setProgressCd1] = useState<number>(0)
  const [_progressCd2, setProgressCd2] = useState<number>(0)
  const [progressText, setProgressText] = useState<string>("")
  const SIZE_CD1 = 619.5 * 1024 * 1024
  const SIZE_CD2 = 557.3 * 1024 * 1024
  const TOTAL_SIZE = SIZE_CD1 + SIZE_CD2
  const [etaText, setEtaText] = useState<string>("")
  const [speedText, setSpeedText] = useState<string>("")
  const lastBytesRef = useRef<number>(0)
  const lastTsRef = useRef<number>(0)
  const speedSamplesRef = useRef<number[]>([])
  const lastUpdateRef = useRef<number>(0)

  const [currentInstallPath, setCurrentInstallPath] = useState<string | undefined>()
  const [showInstallPathModal, setShowInstallPathModal] = useState<boolean>(false)
  const [showErrorModal, setShowErrorModal] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const loadCurrentPath = async () => {
      try {
        const path = await app.getInstallPath()
        setCurrentInstallPath(path)
      } catch (error) {
        console.error('Failed to load install path:', error)
      }
    }
    loadCurrentPath()
  }, [app])

  useEffect(() => {
    setProgress(0)
    
    const formatSeconds = (s: number) => {
      if (!Number.isFinite(s) || s <= 0) return ''
      const sec = Math.max(0, Math.round(s))
      const h = Math.floor(sec / 3600)
      const m = Math.floor((sec % 3600) / 60)
      const rem = sec % 60
      if (h > 0) return `${h}h ${m}m ${rem}s`
      if (m > 0) return `${m}m ${rem}s`
      return `${rem}s`
    }

    const formatSpeed = (bytesPerSec: number) => {
      if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return ''
      const mbps = bytesPerSec / (1024 * 1024)
      if (mbps >= 1) return `${mbps.toFixed(1)} MB/s`
      const kbps = bytesPerSec / 1024
      return `${kbps.toFixed(0)} kB/s`
    }

    const updateSpeedAndEta = (downloadedBytes: number) => {
      const now = Date.now()
      
      if (now - lastUpdateRef.current < 1000) {
        return
      }
      
      if (lastTsRef.current === 0) {
        lastTsRef.current = now
        lastBytesRef.current = downloadedBytes
        lastUpdateRef.current = now
        return
      }

      const dt = (now - lastTsRef.current) / 1000
      const db = downloadedBytes - lastBytesRef.current
      
      if (dt >= 1 && db > 0) {
        const currentSpeed = db / dt
        
        speedSamplesRef.current = [...speedSamplesRef.current, currentSpeed].slice(-5)
        
        const avgSpeed = speedSamplesRef.current.reduce((sum, speed) => sum + speed, 0) / speedSamplesRef.current.length
        
        setSpeedText(formatSpeed(avgSpeed))
        
        const remaining = Math.max(0, TOTAL_SIZE - downloadedBytes)
        if (avgSpeed > 0) {
          const eta = remaining / avgSpeed
          setEtaText(formatSeconds(eta))
        }
        
        lastTsRef.current = now
        lastBytesRef.current = downloadedBytes
        lastUpdateRef.current = now
      }
    }
    
    window.utInstall.onProgress((data) => {
      if (data.stage === 'cd1' && typeof data.progress === 'number') {
        const newCd1Progress = data.progress
        setProgressCd1(newCd1Progress)
        setProgressCd2(currentCd2 => {
          const downloadedBytes = (newCd1Progress / 100 * SIZE_CD1) + (currentCd2 / 100 * SIZE_CD2)
          const combinedPct = Math.min(100, Math.max(0, Math.round((downloadedBytes / TOTAL_SIZE) * 100)))
          setProgress(combinedPct)
          updateSpeedAndEta(downloadedBytes)
          return currentCd2
        })
        setStatus('downloading')
                  setProgressText(`Downloading UT99 • Disc 1 (${data.progress}%)`)
      } else if (data.stage === 'cd2' && typeof data.progress === 'number') {
        const newCd2Progress = data.progress
        setProgressCd2(newCd2Progress)
        setProgressCd1(currentCd1 => {
          const downloadedBytes = (currentCd1 / 100 * SIZE_CD1) + (newCd2Progress / 100 * SIZE_CD2)
          const combinedPct = Math.min(100, Math.max(0, Math.round((downloadedBytes / TOTAL_SIZE) * 100)))
          setProgress(combinedPct)
          updateSpeedAndEta(downloadedBytes)
          return currentCd1
        })
        setStatus('downloading')
                  setProgressText(`Downloading UT99 • Disc 2 (${data.progress}%)`)
      }
    })
    window.utInstall.onStatus((data: { status: string; message?: string }) => {
      if (data.status.startsWith('downloading')) {
        setStatus('downloading')
        if (data.status === 'downloading-cd1') setProgressText('Downloading CD1…')
        if (data.status === 'downloading-cd2') setProgressText('Downloading CD2…')
      } else if (data.status === 'cd1-cached') {
        setProgressText('✓ Game Archive • Disc 1 Ready')
        setProgressCd1(100)
        setProgressCd2(prevCd2 => {
          const downloadedBytes = SIZE_CD1 + (prevCd2 / 100 * SIZE_CD2)
          const combinedPct = Math.min(100, Math.max(0, Math.round((downloadedBytes / TOTAL_SIZE) * 100)))
          setProgress(combinedPct)
          return prevCd2
        })
      } else if (data.status === 'cd2-cached') {
        setProgressText('✓ Game Archive • Disc 2 Ready')
        setProgressCd2(100)
        setProgressCd1(prevCd1 => {
          const downloadedBytes = (prevCd1 / 100 * SIZE_CD1) + SIZE_CD2
          const combinedPct = Math.min(100, Math.max(0, Math.round((downloadedBytes / TOTAL_SIZE) * 100)))
          setProgress(combinedPct)
          return prevCd1
        })
      } else if (data.status.startsWith('installing')) {
        setStatus('installing')
        if (data.status === 'installing-cd1') setProgressText('Installing UT99 • Disc 1')
        if (data.status === 'installing-cd2') setProgressText('Installing UT99 • Disc 2')
        setProgress(100)
      } else if (data.status === 'complete') {
        setStatus('done')
        setProgressText('Installation Complete')
        setProgress(100)
        setShowInstallPathModal(true)
      } else if (data.status === 'error') {
        setStatus('done')
        setProgressText(`Error: ${data.message || 'UT99 Installation Failed'}`)
        setProgress(0)
      }
    })
  }, [SIZE_CD1, SIZE_CD2, TOTAL_SIZE])

  const chooseExisting = async () => {
    const path = await app.pickInstallFolder()
    if (!path) return
    
    const ok = await app.verifyInstallPath(path)
    if (ok) {
      await app.setInstallPath(path)
      setCurrentInstallPath(path)
    } else {
      setErrorMessage('Invalid UT99 installation directory.\n\nPlease select the folder containing:\nSystem/UnrealTournament.exe')
      setShowErrorModal(true)
    }
  }

  const startDownloadAndInstall = async () => {
    try {
      setStatus('downloading')
      setProgress(0)
      setProgressCd1(0)
      setProgressCd2(0)
      setProgressText('🚀 Initializing Download Sequence...')
      await app.startUTInstall()
    } catch (error) {
      console.error('Installation failed:', error)
      setStatus('done')
      setProgressText(`Installation Failed`)
      setProgress(0)
    }
  }

  const handleModalInstallPathSelect = async () => {
    const path = await app.pickInstallFolder()
    if (!path) return
    
    const ok = await app.verifyInstallPath(path)
    if (ok) {
      await app.setInstallPath(path)
      setCurrentInstallPath(path)
      setShowInstallPathModal(false)
      setProgressText('Setup Complete • Ready to Play!')
    } else {
      setErrorMessage('Invalid UT99 installation directory.\n\nPlease select the folder containing:\nSystem/UnrealTournament.exe')
      setShowErrorModal(true)
    }
  }

  return (
    <div className="install-container">
      <div className="nebula-bg" aria-hidden="true" />
      
      <div className="back-button">
        <Button variant="ghost" onClick={onBack} size="sm">
          ← Back
        </Button>
      </div>

      <motion.div
        className="install-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="install-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <motion.img
            src={logo}
            alt="UTBT.net Logo"
            className="install-logo"
            draggable="false"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.15,
              ease: "easeOut"
            }}
          />
          <motion.h1
            className="install-title"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Install Unreal Tournament 1999
          </motion.h1>

          <hr className="install-divider" />
          
          {currentInstallPath ? (
            <motion.div
              className="current-install-display"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="current-install-label">Configured Installation Directory</div>
              <div className="current-install-path">{currentInstallPath}</div>
            </motion.div>
          ) : (
            <motion.p
              className="install-subtitle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Choose your installation method below
            </motion.p>
          )}

          <motion.div
            className="install-actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="install-actions-row">
              <Button 
                variant="secondary" 
                onClick={chooseExisting}
                disabled={status === 'downloading' || status === 'installing'}
              >
                📁 Choose Existing Install
              </Button>
              <Button 
                onClick={startDownloadAndInstall} 
                disabled={status === 'downloading' || status === 'installing'}
              >
                {status === 'downloading' ? 'Downloading…' : status === 'installing' ? 'Installing…' : '🚀 Download & Install'}
              </Button>
            </div>
          </motion.div>

          {status !== 'idle' && (
            <motion.div
              className="progress-section"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="progress-text">
                {progressText}
              </div>
              
              {status === 'downloading' && (
                <div className="progress-details">
                  <div>Overall: {progress}%</div>
                  {speedText && <div>Speed: {speedText}</div>}
                  {etaText && <div>ETA: {etaText}</div>}
                </div>
              )}


            </motion.div>
          )}


        </motion.div>
      </motion.div>

      {showInstallPathModal && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          onClick={() => setShowInstallPathModal(false)}
        >
          <motion.div
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">🎉 Installation Complete!</h2>
            <p className="modal-subtitle">
              Please select the folder where UT99 was installed to complete the setup.
            </p>
            <div className="modal-actions">
              <Button onClick={handleModalInstallPathSelect}>
                📁 Select Install Folder
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowInstallPathModal(false)}
              >
                Skip for Now
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showErrorModal && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          onClick={() => setShowErrorModal(false)}
        >
          <motion.div
            className="modal-content modal-error"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">Invalid Path</h2>
            <p className="modal-subtitle">
              {errorMessage}
            </p>
            <div className="modal-actions">
              <Button onClick={() => setShowErrorModal(false)}>
                OK
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
