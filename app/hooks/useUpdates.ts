import { useState, useEffect, useCallback, useRef } from 'react'
import { UpdateState, PatchManifest } from '@/app/types'
import { updateService } from '@/app/services/UpdateService'

export function useUpdates() {
  const patchTagRef = useRef<string | undefined>(undefined)
  const [updateState, setUpdateState] = useState<UpdateState>({
    available: false,
    updating: false,
    progress: 0,
    progressText: '',
    forced: false
  })

  const checkForUpdates = useCallback(async (channel?: 'stable' | 'rc') => {
    try {
      const currentVersion = await updateService.getCurrentVersion()
      const updateCheck = await updateService.checkForUpdates(channel)
      
      setUpdateState(prev => ({
        ...prev,
        available: updateCheck.available,
        manifest: updateCheck.manifest,
        currentVersion,
        forced: updateCheck.forced
      }))

      return updateCheck
    } catch (error) {
      console.error('Failed to check for updates:', error)
      return { available: false, forced: false }
    }
  }, [])

  useEffect(() => {
    checkForUpdates()
  }, [checkForUpdates])

  const applyUpdate = async (manifest: PatchManifest) => {
    try {
      setUpdateState(prev => ({
        ...prev,
        updating: true,
        progress: 0,
        progressText: 'Starting…'
      }))

      await updateService.applyUpdate(manifest)
    } catch (error) {
      setUpdateState(prev => ({
        ...prev,
        updating: false,
        progressText: 'Update failed'
      }))
      throw error
    }
  }

  const openReleaseNotes = (url?: string) => {
    updateService.openReleaseNotes(url)
  }

  useEffect(() => {
    const handleInstallProgress = (data: { stage?: string; progress?: number }) => {
      if (data.stage === 'patch' && typeof data.progress === 'number') {
        const pct = data.progress as number
        setUpdateState(prev => ({
          ...prev,
          progress: pct,
          progressText: `Downloading Patch${patchTagRef.current ? ` ${patchTagRef.current}` : ''} (${pct}%)`
        }))
      }
    }

    const handlePatchStatus = (data: { status: string; message?: string; tag?: string }) => {
      if (data.tag) {
        patchTagRef.current = data.tag
      }
      if (data.status === 'downloading') {
        setUpdateState(prev => ({ ...prev, progressText: `Downloading Patch: ${data.tag ?? patchTagRef.current ?? ''}…` }))
      } else if (data.status === 'verifying') {
        setUpdateState(prev => ({ ...prev, progressText: `Verifying Patch: ${data.tag ?? patchTagRef.current ?? ''}…` }))
      } else if (data.status === 'applying') {
        setUpdateState(prev => ({ ...prev, progressText: `Applying Patch: ${data.tag ?? patchTagRef.current ?? ''}…` }))
      } else if (data.status === 'complete') {
        setUpdateState(prev => ({
          ...prev,
          progressText: `Patch: ${data.tag ?? patchTagRef.current ?? ''} Applied`,
          progress: 100,
          updating: false,
          available: false
        }))
      } else if (data.status === 'error') {
        setUpdateState(prev => ({
          ...prev,
          progressText: `Patch: ${data.tag ?? patchTagRef.current ?? ''} Failed`,
          updating: false
        }))
      }
    }

    const offProgress = window.utInstall?.onProgress(handleInstallProgress)
    const offPatchStatus = window.utPatch?.onStatus(handlePatchStatus)

    return () => {
      offProgress?.()
      offPatchStatus?.()
    }
  }, [])

  return {
    updateState,
    checkForUpdates,
    applyUpdate,
    openReleaseNotes,
    dismissUpdate: () => setUpdateState(prev => ({ ...prev, available: false }))
  }
}
