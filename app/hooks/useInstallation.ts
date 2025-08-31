import { useState, useEffect, useRef, useCallback } from 'react'
import { InstallationState, InstallationConfig } from '@/app/types'
import { installationService } from '@/app/services/InstallationService'
import { updateService } from '@/app/services/UpdateService'

interface InstallationCallbacks {
  onInstallComplete?: () => void
  onAnnouncerComplete?: () => void
}

export function useInstallation(callbacks?: InstallationCallbacks) {
  const onInstallComplete = useCallback(() => {
    callbacks?.onInstallComplete?.()
  }, [callbacks])

  const onAnnouncerComplete = useCallback(() => {
    callbacks?.onAnnouncerComplete?.()
  }, [callbacks])
  const [state, setState] = useState<InstallationState>({
    status: 'idle',
    progress: 0,
    progressText: '',
    speedText: '',
    etaText: ''
  })

  const [config, setConfig] = useState<InstallationConfig>({
    patchChannel: 'stable'
  })

  // Progress tracking refs
  const [_progressCd1, setProgressCd1] = useState(0)
  const [_progressCd2, setProgressCd2] = useState(0)
  const lastBytesRef = useRef(0)
  const lastTsRef = useRef(0)
  const speedSamplesRef = useRef<number[]>([])
  const lastUpdateRef = useRef(0)
  const patchTagRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const loadConfig = async () => {
      const initialConfig = await installationService.getInstallConfig()
      setConfig(initialConfig)
    }
    loadConfig()
  }, [onInstallComplete])

  const updateSpeedAndEta = (downloadedBytes: number) => {
    const now = Date.now()
    
    if (now - lastUpdateRef.current < 1000) return
    
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
      
      setState(prev => ({
        ...prev,
        speedText: installationService.formatSpeed(avgSpeed)
      }))
      
      const remaining = Math.max(0, installationService.TOTAL_SIZE - downloadedBytes)
      if (avgSpeed > 0) {
        const eta = remaining / avgSpeed
        setState(prev => ({
          ...prev,
          etaText: installationService.formatTime(eta)
        }))
      }
      
      lastTsRef.current = now
      lastBytesRef.current = downloadedBytes
      lastUpdateRef.current = now
    }
  }

  useEffect(() => {
    const handleProgress = (data: { stage?: string; progress?: number }) => {
      if (data.stage === 'cd1' && typeof data.progress === 'number') {
        const progress = data.progress as number
        setProgressCd1(progress)
        setProgressCd2(currentCd2 => {
          const downloadedBytes = (progress / 100 * installationService.SIZE_CD1) + (currentCd2 / 100 * installationService.SIZE_CD2)
          const combinedPct = installationService.calculateCombinedProgress(progress, currentCd2)
          setState(prev => ({
            ...prev,
            status: 'downloading',
            progress: combinedPct,
            progressText: `Downloading UT99 • Disc 1 (${progress}%)`
          }))
          updateSpeedAndEta(downloadedBytes)
          return currentCd2
        })
      } else if (data.stage === 'cd2' && typeof data.progress === 'number') {
        const progress = data.progress as number
        setProgressCd2(progress)
        setProgressCd1(currentCd1 => {
          const downloadedBytes = (currentCd1 / 100 * installationService.SIZE_CD1) + (progress / 100 * installationService.SIZE_CD2)
          const combinedPct = installationService.calculateCombinedProgress(currentCd1, progress)
          setState(prev => ({
            ...prev,
            status: 'downloading',
            progress: combinedPct,
            progressText: `Downloading UT99 • Disc 2 (${progress}%)`
          }))
          updateSpeedAndEta(downloadedBytes)
          return currentCd1
        })
      } else if (data.stage === 'patch' && typeof data.progress === 'number') {
        setState(prev => ({
          ...prev,
          status: 'installing',
          progressText: `Downloading Patch${patchTagRef.current ? ` ${patchTagRef.current}` : ''}… (${data.progress}%)`
        }))
      } else if (data.stage === 'announcer' && typeof data.progress === 'number') {
        setState(prev => ({
          ...prev,
          status: 'installing',
          progressText: `Downloading Modern Announcer… (${data.progress}%)`
        }))
      }
    }

    const handleStatus = (data: { status: string; message?: string }) => {
      if (data.status.startsWith('downloading')) {
        setState(prev => ({ ...prev, status: 'downloading' }))
        installationService.setWindowLocked(true)
        
        if (data.status === 'downloading-cd1') {
          setState(prev => ({ ...prev, progressText: 'Downloading CD1…' }))
        } else if (data.status === 'downloading-cd2') {
          setState(prev => ({ ...prev, progressText: 'Downloading CD2…' }))
        }
      } else if (data.status === 'cd1-cached') {
        setState(prev => ({ ...prev, progressText: '✓ Game Archive • Disc 1 Ready' }))
        setProgressCd1(100)
        setProgressCd2(prevCd2 => {
          const combinedPct = installationService.calculateCombinedProgress(100, prevCd2)
          setState(prev => ({ ...prev, progress: combinedPct }))
          return prevCd2
        })
      } else if (data.status === 'cd2-cached') {
        setState(prev => ({ ...prev, progressText: '✓ Game Archive • Disc 2 Ready' }))
        setProgressCd2(100)
        setProgressCd1(prevCd1 => {
          const combinedPct = installationService.calculateCombinedProgress(prevCd1, 100)
          setState(prev => ({ ...prev, progress: combinedPct }))
          return prevCd1
        })
      } else if (data.status.startsWith('installing')) {
        setState(prev => ({ ...prev, status: 'installing', progress: 100 }))
        installationService.setWindowLocked(true)
        
        if (data.status === 'installing-cd1') {
          setState(prev => ({ ...prev, progressText: 'Installing UT99 • Disc 1' }))
        } else if (data.status === 'installing-cd2') {
          setState(prev => ({ ...prev, progressText: 'Installing UT99 • Disc 2' }))
        }
      } else if (data.status === 'announcer-complete') {
        setState(prev => ({
          ...prev,
          status: 'done',
          progressText: 'Game Installation Completed',
          progress: 100
        }))
        installationService.setWindowLocked(false)
        onAnnouncerComplete()
      } else if (data.status === 'error') {
        setState(prev => ({
          ...prev,
          status: 'error',
          progressText: `Error: ${data.message || 'UT99 Installation Failed'}`,
          progress: 0,
          error: data.message
        }))
        installationService.setWindowLocked(false)
      }
    }

    const offProgress = window.utInstall?.onProgress(handleProgress)
    const offStatus = window.utInstall?.onStatus(handleStatus)

    return () => {
      offProgress?.()
      offStatus?.()
    }
  }, [])

  useEffect(() => {
    const handlePatchStatus = (data: { status: string; message?: string; tag?: string }) => {
      if (data.tag) {
        patchTagRef.current = data.tag
      }
      if (data.status === 'downloading') {
        setState(prev => ({ ...prev, progressText: `Downloading Patch: ${data.tag ?? patchTagRef.current ?? ''}…` }))
      } else if (data.status === 'verifying') {
        setState(prev => ({ ...prev, progressText: `Verifying Patch: ${data.tag ?? patchTagRef.current ?? ''}…` }))
      } else if (data.status === 'applying') {
        setState(prev => ({ ...prev, progressText: `Applying Patch: ${data.tag ?? patchTagRef.current ?? ''}…` }))
      } else if (data.status === 'complete') {
        setState(prev => ({
          ...prev,
          progressText: `Patch: ${data.tag ?? patchTagRef.current ?? ''} Installed`,
          status: 'done'
        }))
      } else if (data.status === 'error') {
        setState(prev => ({
          ...prev,
          progressText: `Patch: ${data.tag ?? patchTagRef.current ?? ''} Failed${data.message ? `: ${data.message}` : ''}`,
          status: 'error',
          error: data.message
        }))
      }
    }

    const offPatchStatus = window.utPatch?.onStatus(handlePatchStatus)

    return () => {
      offPatchStatus?.()
    }
  }, [])

  const actions = {
    startInstallation: async () => {
      try {
        setState(prev => ({
          ...prev,
          status: 'downloading',
          progress: 0,
          progressText: 'Starting Download...',
          speedText: '',
          etaText: '',
          error: undefined
        }))
        setProgressCd1(0)
        setProgressCd2(0)
        await installationService.startInstallation()
      } catch (error) {
        setState(prev => ({
          ...prev,
          status: 'error',
          progressText: 'Installation Failed',
          progress: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    },

    setInstallPath: async (path: string): Promise<boolean> => {
      const success = await installationService.setInstallPath(path)
      if (success) {
        setConfig(prev => ({ ...prev, installPath: path }))
      }
      return success
    },

    setPatchChannel: async (channel: 'stable' | 'rc') => {
      await installationService.setPatchChannel(channel)
      setConfig(prev => ({ ...prev, patchChannel: channel }))
    },

    pickInstallFolder: () => installationService.pickInstallFolder(),

    applyPatchAfterInstall: async (installPath: string, patchChannel: 'stable' | 'rc') => {
      try {
        const success = await installationService.setInstallPath(installPath)
        if (!success) {
          throw new Error('Invalid installation path')
        }

        await installationService.setPatchChannel(patchChannel)
        await updateService.setupBaseVersion()

        const manifestResp = await window.conveyor.app.fetchLatestPatchManifest(patchChannel === 'stable' ? true : undefined)
        if (manifestResp?.success && manifestResp.data) {
          const data = manifestResp.data
          patchTagRef.current = data.tag
          setState(prev => ({
            ...prev,
            status: 'installing',
            progressText: `Downloading Patch ${data.tag}…`
          }))

          await installationService.applyPatch({
            asset_url: data.asset_url,
            sha256: data.sha256,
            tag: data.tag,
            channel: (data.channel as 'stable' | 'rc') || patchChannel,
          })

          setState(prev => ({
            ...prev,
            progressText: `Patch ${data.tag} Applied • Installing UTBT Announcer…`
          }))

          await installationService.installAnnouncer()

          setState(prev => ({
            ...prev,
            status: 'done',
            progress: 100,
            progressText: 'Game Installation Completed'
          }))

          onAnnouncerComplete()
        }

        // Update config
        setConfig(prev => ({ ...prev, installPath }))
      } catch (error) {
        console.error('Patch apply error:', error)
        setState(prev => ({
          ...prev,
          progressText: 'Patch apply failed',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
        throw error
      }
    },

    reset: () => {
      setState({
        status: 'idle',
        progress: 0,
        progressText: '',
        speedText: '',
        etaText: ''
      })
      setProgressCd1(0)
      setProgressCd2(0)
      lastBytesRef.current = 0
      lastTsRef.current = 0
      speedSamplesRef.current = []
      lastUpdateRef.current = 0
    }
  }

  return {
    state,
    config,
    actions
  }
}
