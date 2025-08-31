import { contextBridge, ipcRenderer } from 'electron'
import { conveyor } from '@/lib/conveyor/api'

// Use `contextBridge` APIs to expose APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
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
    })
  } catch (error) {
    console.error(error)
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
  }
}
