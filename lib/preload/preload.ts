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
        ipcRenderer.on('ut-install-progress', (_, data) => cb(data))
      },
      onStatus: (cb: (data: { status: string }) => void) => {
        ipcRenderer.on('ut-install-status', (_, data) => cb(data))
      },
    })
  } catch (error) {
    console.error(error)
  }
} else {
  window.conveyor = conveyor
  window.utInstall = {
    onProgress: (cb: (data: { stage?: string; progress?: number }) => void) => {
      ipcRenderer.on('ut-install-progress', (_, data) => cb(data))
    },
    onStatus: (cb: (data: { status: string }) => void) => {
      ipcRenderer.on('ut-install-status', (_, data) => cb(data))
    },
  }
}
