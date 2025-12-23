import { contextBridge, ipcRenderer } from 'electron'
import { conveyor } from '@/lib/conveyor/api'

// Use `contextBridge` APIs to expose APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    conveyor.app.getUploadLogs = () => ipcRenderer.invoke('getUploadLogs')
    contextBridge.exposeInMainWorld('conveyor', conveyor)
    contextBridge.exposeInMainWorld('utInstall', {
      onProgress: (cb: (data: { stage?: string; progress?: number }) => void) => {
        const listener = (_: unknown, data: { stage?: string; progress?: number }) => cb(data)
        ipcRenderer.on('ut-install-progress', listener)
        return () => ipcRenderer.removeListener('ut-install-progress', listener)
      },
      onStatus: (cb: (data: { status: string }) => void) => {
        const listener = (_: unknown, data: { status: string }) => cb(data)
        ipcRenderer.on('ut-install-status', listener)
        return () => ipcRenderer.removeListener('ut-install-status', listener)
      },
      onConfirm: (cb: (data: { id: string; title: string; message: string; detail?: string }) => void) => {
        const listener = (
          _: unknown,
          data: { id: string; title: string; message: string; detail?: string }
        ) => cb(data)
        ipcRenderer.on('ut-install-confirm', listener)
        return () => ipcRenderer.removeListener('ut-install-confirm', listener)
      },
      respondConfirm: (id: string, accepted: boolean) => {
        ipcRenderer.send('ut-install-confirm-response', { id, accepted })
      },
      onIsoDownloadProgress: (cb: (data: { progress: number; totalBytes: number; downloadedBytes: number }) => void) => {
        const listener = (_: unknown, data: { progress: number; totalBytes: number; downloadedBytes: number }) => cb(data)
        ipcRenderer.on('iso-download-progress', listener)
        return () => ipcRenderer.removeListener('iso-download-progress', listener)
      },
    })
    contextBridge.exposeInMainWorld('utPatch', {
      onStatus: (cb: (data: { status: string; message?: string; tag?: string }) => void) => {
        const listener = (
          _: unknown,
          data: { status: string; message?: string; tag?: string }
        ) => cb(data)
        ipcRenderer.on('ut-patch-status', listener)
        return () => ipcRenderer.removeListener('ut-patch-status', listener)
      },
      onPatchInstallStatus: (cb: (data: { status: string; tag?: string; message?: string }) => void) => {
        const listener = (_: unknown, data: { status: string; tag?: string; message?: string }) => cb(data)
        ipcRenderer.on('patch-install-status', listener)
        return () => ipcRenderer.removeListener('patch-install-status', listener)
      },
      onPatchInstallProgress: (cb: (data: { progress: number }) => void) => {
        const listener = (_: unknown, data: { progress: number }) => cb(data)
        ipcRenderer.on('patch-install-progress', listener)
        return () => ipcRenderer.removeListener('patch-install-progress', listener)
      },
      onInstallationPathUpdated: (cb: (data: { version: string }) => void) => {
        const listener = (_: unknown, data: { version: string }) => cb(data)
        ipcRenderer.on('installation-path-updated', listener)
        return () => ipcRenderer.removeListener('installation-path-updated', listener)
      },
      onAnnouncerInstallProgress: (cb: (data: { progress: number }) => void) => {
        const listener = (_: unknown, data: { progress: number }) => cb(data)
        ipcRenderer.on('announcer-install-progress', listener)
        return () => ipcRenderer.removeListener('announcer-install-progress', listener)
      },
      onAnnouncerInstallComplete: (cb: () => void) => {
        const listener = () => cb()
        ipcRenderer.on('announcer-install-complete', listener)
        return () => ipcRenderer.removeListener('announcer-install-complete', listener)
      },
    })
    contextBridge.exposeInMainWorld('logging', {
      log: async (level: string, message: string, context?: string, data?: any) => {
        return ipcRenderer.invoke('logMessage', level, message, context, data)
      },
      info: async (message: string, context?: string, data?: any) => {
        return ipcRenderer.invoke('logMessage', 'info', message, context, data)
      },
      warn: async (message: string, context?: string, data?: any) => {
        return ipcRenderer.invoke('logMessage', 'warn', message, context, data)
      },
      error: async (message: string, context?: string, data?: any) => {
        return ipcRenderer.invoke('logMessage', 'error', message, context, data)
      },
      debug: async (message: string, context?: string, data?: any) => {
        return ipcRenderer.invoke('logMessage', 'debug', message, context, data)
      },
      getLogFilePath: async () => ipcRenderer.invoke('getLogFilePath'),
      getRecentLogs: async (lines?: number) => ipcRenderer.invoke('getRecentLogs', lines),
    })
    contextBridge.exposeInMainWorld('auth', {
      login: async () => ipcRenderer.invoke('auth:login'),
      logout: async () => ipcRenderer.invoke('auth:logout'),
      getProfile: async () => ipcRenderer.invoke('auth:get-profile'),
    })
  } catch (error) {
    console.error('Preload script error:', error)
  }
} else {
  window.conveyor = conveyor
  window.utInstall = {
    onProgress: (cb: (data: { stage?: string; progress?: number }) => void) => {
      const listener = (_: unknown, data: { stage?: string; progress?: number }) => cb(data)
      ipcRenderer.on('ut-install-progress', listener)
      return () => ipcRenderer.removeListener('ut-install-progress', listener)
    },
    onStatus: (cb: (data: { status: string }) => void) => {
      const listener = (_: unknown, data: { status: string }) => cb(data)
      ipcRenderer.on('ut-install-status', listener)
      return () => ipcRenderer.removeListener('ut-install-status', listener)
    },
    onConfirm: (cb: (data: { id: string; title: string; message: string; detail?: string }) => void) => {
      const listener = (
        _: unknown,
        data: { id: string; title: string; message: string; detail?: string }
      ) => cb(data)
      ipcRenderer.on('ut-install-confirm', listener)
      return () => ipcRenderer.removeListener('ut-install-confirm', listener)
    },
    respondConfirm: (id: string, accepted: boolean) => {
      ipcRenderer.send('ut-install-confirm-response', { id, accepted })
    },
    onIsoDownloadProgress: (cb: (data: { progress: number; totalBytes: number; downloadedBytes: number }) => void) => {
      const listener = (_: unknown, data: { progress: number; totalBytes: number; downloadedBytes: number }) => cb(data)
      ipcRenderer.on('iso-download-progress', listener)
      return () => ipcRenderer.removeListener('iso-download-progress', listener)
    },
  }
  window.utPatch = {
    onStatus: (cb: (data: { status: string; message?: string; tag?: string }) => void) => {
      const listener = (
        _: unknown,
        data: { status: string; message?: string; tag?: string }
      ) => cb(data)
      ipcRenderer.on('ut-patch-status', listener)
      return () => ipcRenderer.removeListener('ut-patch-status', listener)
    },
    onPatchInstallStatus: (cb: (data: { status: string; tag?: string; message?: string }) => void) => {
      const listener = (_: unknown, data: { status: string; tag?: string; message?: string }) => cb(data)
      ipcRenderer.on('patch-install-status', listener)
      return () => ipcRenderer.removeListener('patch-install-status', listener)
    },
    onPatchInstallProgress: (cb: (data: { progress: number }) => void) => {
      const listener = (_: unknown, data: { progress: number }) => cb(data)
      ipcRenderer.on('patch-install-progress', listener)
      return () => ipcRenderer.removeListener('patch-install-progress', listener)
    },
    onInstallationPathUpdated: (cb: (data: { version: string }) => void) => {
      const listener = (_: unknown, data: { version: string }) => cb(data)
      ipcRenderer.on('installation-path-updated', listener)
      return () => ipcRenderer.removeListener('installation-path-updated', listener)
    },
    onAnnouncerInstallProgress: (cb: (data: { progress: number }) => void) => {
      const listener = (_: unknown, data: { progress: number }) => cb(data)
      ipcRenderer.on('announcer-install-progress', listener)
      return () => ipcRenderer.removeListener('announcer-install-progress', listener)
    },
    onAnnouncerInstallComplete: (cb: () => void) => {
      const listener = () => cb()
      ipcRenderer.on('announcer-install-complete', listener)
      return () => ipcRenderer.removeListener('announcer-install-complete', listener)
    },
  }
  window.logging = {
    log: async (level: string, message: string, context?: string, data?: any) => {
      return ipcRenderer.invoke('logMessage', level, message, context, data)
    },
    info: async (message: string, context?: string, data?: any) => {
      return ipcRenderer.invoke('logMessage', 'info', message, context, data)
    },
    warn: async (message: string, context?: string, data?: any) => {
      return ipcRenderer.invoke('logMessage', 'warn', message, context, data)
    },
    error: async (message: string, context?: string, data?: any) => {
      return ipcRenderer.invoke('logMessage', 'error', message, context, data)
    },
    debug: async (message: string, context?: string, data?: any) => {
      return ipcRenderer.invoke('logMessage', 'debug', message, context, data)
    },
    getLogFilePath: async () => ipcRenderer.invoke('getLogFilePath'),
    getRecentLogs: async (lines?: number) => ipcRenderer.invoke('getRecentLogs', lines),
  }
  window.conveyor.app.getUploadLogs = () => ipcRenderer.invoke('getUploadLogs')
  window.auth = {
    login: async () => ipcRenderer.invoke('auth:login'),
    logout: async () => ipcRenderer.invoke('auth:logout'),
    getProfile: async () => ipcRenderer.invoke('auth:get-profile'),
  }
}
