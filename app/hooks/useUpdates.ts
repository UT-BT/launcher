import { useState, useEffect, useCallback } from 'react'
import { UpdateState, PatchManifest } from '@/app/types'
import { updateService } from '@/app/services/UpdateService'

export function useUpdates() {
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
    const handleInstallProgress = (data: { stage: string; progress: number }) => {
      if (data.stage === 'patch' && typeof data.progress === 'number') {
        setUpdateState(prev => ({
          ...prev,
          progress: data.progress,
          progressText: `Downloading Latest Patch (${data.progress}%)`
        }))
      }
    }

    const handlePatchStatus = (data: { status: string; message?: string; tag?: string }) => {
      if (data.status === 'downloading') {
        setUpdateState(prev => ({ ...prev, progressText: 'Downloading Latest Patch…' }))
      } else if (data.status === 'verifying') {
        setUpdateState(prev => ({ ...prev, progressText: 'Verifying Patch…' }))
      } else if (data.status === 'applying') {
        setUpdateState(prev => ({ ...prev, progressText: 'Applying Patch…' }))
      } else if (data.status === 'complete') {
        setUpdateState(prev => ({
          ...prev,
          progressText: 'Latest Patch Applied',
          progress: 100,
          updating: false,
          available: false
        }))
      } else if (data.status === 'error') {
        setUpdateState(prev => ({
          ...prev,
          progressText: 'Patch Update Failed',
          updating: false
        }))
      }
    }

    window.utInstall?.onProgress(handleInstallProgress)
    window.utPatch?.onStatus(handlePatchStatus)

    return () => {}
  }, [])

  return {
    updateState,
    checkForUpdates,
    applyUpdate,
    openReleaseNotes,
    dismissUpdate: () => setUpdateState(prev => ({ ...prev, available: false }))
  }
}
