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
  const [patchChannel, setPatchChannel] = useState<'stable' | 'rc'>('stable')
  const helpIconRef = useRef<HTMLSpanElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [rcTooltipVisible, setRcTooltipVisible] = useState<boolean>(false)
  const [rcTooltipPos, setRcTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const rcTooltipTimerRef = useRef<number | null>(null)
  const { webSetLocked } = useConveyor('window')

  // In-app confirm for CD2
  const [showCd2Modal, setShowCd2Modal] = useState<boolean>(false)
  const [cd2ConfirmId, setCd2ConfirmId] = useState<string | null>(null)
  const [cd2Title, setCd2Title] = useState<string>('')
  const [cd2Message, setCd2Message] = useState<string>('')
  const [cd2Detail, setCd2Detail] = useState<string>('')

  useEffect(() => {
    const loadCurrentPath = async () => {
      try {
        const path = await app.getInstallPath()
        setCurrentInstallPath(path)
        const ch = await app.getPatchChannel()
        setPatchChannel(ch)
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
        const ctx = document.getElementById('titlebar-context')
        if (ctx) ctx.dispatchEvent(new CustomEvent('set-titlebar-lock', { detail: { locked: true } }))
        webSetLocked(true).catch(() => {})
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
        const ctx = document.getElementById('titlebar-context')
        if (ctx) ctx.dispatchEvent(new CustomEvent('set-titlebar-lock', { detail: { locked: true } }))
        webSetLocked(true).catch(() => {})
        if (data.status === 'installing-cd1') setProgressText('Installing UT99 • Disc 1')
        if (data.status === 'installing-cd2') setProgressText('Installing UT99 • Disc 2')
        setProgress(100)
      } else if (data.status === 'complete') {
        setStatus('done')
        setProgressText('Installation Complete')
        setProgress(100)
        setShowInstallPathModal(true)
        const ctx = document.getElementById('titlebar-context')
        if (ctx) ctx.dispatchEvent(new CustomEvent('set-titlebar-lock', { detail: { locked: false } }))
        webSetLocked(false).catch(() => {})
      } else if (data.status === 'error') {
        setStatus('done')
        setProgressText(`Error: ${data.message || 'UT99 Installation Failed'}`)
        setProgress(0)
        const ctx = document.getElementById('titlebar-context')
        if (ctx) ctx.dispatchEvent(new CustomEvent('set-titlebar-lock', { detail: { locked: false } }))
        webSetLocked(false).catch(() => {})
      }
    })

    window.utInstall.onProgress((data) => {
      if (data.stage === 'patch' && typeof data.progress === 'number') {
        setStatus('installing')
        setProgressText(`Downloading Patch (${data.progress}%)`)
      }
    })
    window.utPatch.onStatus((data: { status: string; message?: string; tag?: string }) => {
      if (data.status === 'downloading') setProgressText('Downloading Patch…')
      if (data.status === 'verifying') setProgressText('Verifying Patch…')
      if (data.status === 'applying') setProgressText('Applying Patch…')
      if (data.status === 'complete') {
        setProgressText(`Patch ${data.tag ?? ''} Applied`)
        setStatus('done')
      }
      if (data.status === 'error') {
        setProgressText(`Patch Update Failed${data.message ? `: ${data.message}` : ''}`)
        setStatus('done')
      }
    })
  }, [SIZE_CD1, SIZE_CD2, TOTAL_SIZE, webSetLocked])

  useEffect(() => {
    return () => {
      if (rcTooltipTimerRef.current) {
        window.clearTimeout(rcTooltipTimerRef.current)
        rcTooltipTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    window.utInstall.onConfirm((data) => {
      setCd2ConfirmId(data.id)
      setCd2Title(data.title)
      setCd2Message(data.message)
      setCd2Detail(data.detail || '')
      setShowCd2Modal(true)
    })
  }, [])

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
      
      try { await app.setPatchChannel(patchChannel) } catch (err) { console.warn('Failed to set patch channel after setting path', err) }
      setCurrentInstallPath(path)
      setShowInstallPathModal(false)
      try {
        await app.setBaseVersion('v432')
        const manifestResp = await app.fetchLatestPatchManifest(patchChannel === 'stable' ? true : undefined)
        if (manifestResp?.success && manifestResp.data) {
          setStatus('installing')
          setProgressText(`Downloading Patch ${manifestResp.data.tag}…`)
          await app.applyPatchFromManifest({
            asset_url: manifestResp.data.asset_url,
            sha256: manifestResp.data.sha256,
            tag: manifestResp.data.tag,
            channel: (manifestResp.data.channel as 'stable' | 'rc') || patchChannel,
          })
          setProgressText(`Patch ${manifestResp.data.tag} Applied • Ready to Play!`)
        }
      } catch (e) {
        console.error('Patch apply error:', e)
        setProgressText('Patch apply failed')
      }
    } else {
      setErrorMessage('Invalid UT99 installation directory.\n\nPlease select the folder containing:\nSystem/UnrealTournament.exe')
      setShowErrorModal(true)
    }
  }

  return (
    <div className="install-container">
      <div className="nebula-bg" aria-hidden="true" />
      
      <div className="back-button">
        <Button variant="ghost" onClick={onBack} size="sm" disabled={status === 'downloading' || status === 'installing'}>
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
            <div className="install-preferences">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={patchChannel === 'stable'}
                  disabled={status === 'downloading' || status === 'installing'}
                  onChange={async (e) => {
                    if (e.target.checked) {
                      setPatchChannel('stable')
                      try { await app.setPatchChannel('stable') } catch (err) { console.warn('Failed to set patch channel', err) }
                    }
                  }}
                />
                <span>Install full release patches only</span>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={patchChannel === 'rc'}
                  disabled={status === 'downloading' || status === 'installing'}
                  onChange={async (e) => {
                    if (e.target.checked) {
                      setPatchChannel('rc')
                      try { await app.setPatchChannel('rc') } catch (err) { console.warn('Failed to set patch channel', err) }
                    }
                  }}
                />
                <span>Install release candidate patches
                  <span
                    className="help-icon"
                    aria-label="Help"
                    ref={helpIconRef}
                    tabIndex={0}
                    onMouseEnter={() => {
                      if (rcTooltipTimerRef.current) window.clearTimeout(rcTooltipTimerRef.current)
                      rcTooltipTimerRef.current = window.setTimeout(() => {
                        const icon = helpIconRef.current
                        const tip = tooltipRef.current
                        if (!icon || !tip) return
                        const rect = icon.getBoundingClientRect()
                        const padding = 8
                        const vw = window.innerWidth
                        const vh = window.innerHeight
                        const tipWidth = tip.offsetWidth || 300
                        const tipHeight = tip.offsetHeight || 80
                        let top = rect.top - tipHeight - 8
                        let left = rect.left + (rect.width / 2) - (tipWidth / 2)
                        if (left < padding) left = padding
                        if (left + tipWidth + padding > vw) left = vw - tipWidth - padding
                        if (top < padding) top = rect.bottom + 8
                        if (top + tipHeight + padding > vh) top = Math.max(padding, vh - tipHeight - padding)
                        setRcTooltipPos({ top, left })
                        setRcTooltipVisible(true)
                      }, 200)
                    }}
                    onMouseLeave={() => {
                      if (rcTooltipTimerRef.current) {
                        window.clearTimeout(rcTooltipTimerRef.current)
                        rcTooltipTimerRef.current = null
                      }
                      setRcTooltipVisible(false)
                    }}
                    onFocus={() => {
                      // mimic hover for keyboard focus
                      if (rcTooltipTimerRef.current) window.clearTimeout(rcTooltipTimerRef.current)
                      rcTooltipTimerRef.current = window.setTimeout(() => {
                        const icon = helpIconRef.current
                        const tip = tooltipRef.current
                        if (!icon || !tip) return
                        const rect = icon.getBoundingClientRect()
                        const padding = 8
                        const vw = window.innerWidth
                        const vh = window.innerHeight
                        const tipWidth = tip.offsetWidth || 300
                        const tipHeight = tip.offsetHeight || 80
                        let top = rect.top - tipHeight - 8
                        let left = rect.left + (rect.width / 2) - (tipWidth / 2)
                        if (left < padding) left = padding
                        if (left + tipWidth + padding > vw) left = vw - tipWidth - padding
                        if (top < padding) top = rect.bottom + 8
                        if (top + tipHeight + padding > vh) top = Math.max(padding, vh - tipHeight - padding)
                        setRcTooltipPos({ top, left })
                        setRcTooltipVisible(true)
                      }, 200)
                    }}
                    onBlur={() => {
                      if (rcTooltipTimerRef.current) {
                        window.clearTimeout(rcTooltipTimerRef.current)
                        rcTooltipTimerRef.current = null
                      }
                      setRcTooltipVisible(false)
                    }}
                  >
                    ℹ️
                  </span>
                </span>
              </label>
            </div>
            <div className="install-actions-row">
              <Button 
                variant="secondary" 
                onClick={chooseExisting}
                disabled={status === 'downloading' || status === 'installing'}
              >
                {currentInstallPath ? '📁 Change Install Directory' : '📁 Choose Existing Install'}
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

      {showCd2Modal && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          onClick={() => {
            if (cd2ConfirmId) window.utInstall.respondConfirm(cd2ConfirmId, false)
            setShowCd2Modal(false)
          }}
        >
          <motion.div
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">{cd2Title}</h2>
            <p className="modal-subtitle">
              {cd2Message}
              {cd2Detail ? (<><br /><br />{cd2Detail}</>) : null}
            </p>
            <div className="modal-actions">
              <Button onClick={() => { if (cd2ConfirmId) window.utInstall.respondConfirm(cd2ConfirmId, true); setShowCd2Modal(false) }}>
                Yes
              </Button>
              <Button variant="ghost" onClick={() => { if (cd2ConfirmId) window.utInstall.respondConfirm(cd2ConfirmId, false); setShowCd2Modal(false) }}>
                No
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

      <div
        ref={tooltipRef}
        className={`custom-tooltip${rcTooltipVisible ? ' visible' : ''}`}
        style={{ top: rcTooltipPos.top, left: rcTooltipPos.left }}
        role="tooltip"
        aria-hidden={!rcTooltipVisible}
      >
        Unreal Tournament developers often release pre-release versions of newer patches to allow the community to test features. <br /><br />These patches are considered mostly stable by the developers, but could still contain some small bugs and issues.
      </div>
    </div>
  )
}
