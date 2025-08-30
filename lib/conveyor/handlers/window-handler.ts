import type { BrowserWindow } from 'electron'
import { shell } from 'electron'
import { handle } from '@/lib/main/shared'
import { electronAPI } from '@electron-toolkit/preload'

export const registerWindowHandlers = (window: BrowserWindow) => {
  let webLocked = false
  // Window operations
  handle('window-init', () => {
    const { width, height } = window.getBounds()
    const minimizable = window.isMinimizable()
    const maximizable = window.isMaximizable()
    const platform = electronAPI.process.platform

    return { width, height, minimizable, maximizable, platform }
  })

  handle('window-is-minimizable', () => window.isMinimizable())
  handle('window-is-maximizable', () => window.isMaximizable())
  handle('window-minimize', () => window.minimize())
  handle('window-maximize', () => window.maximize())
  handle('window-close', () => window.close())
  handle('window-maximize-toggle', () => (window.isMaximized() ? window.unmaximize() : window.maximize()))

  handle('web-set-locked', (locked: boolean) => {
    webLocked = Boolean(locked)
  })

  // Web content operations
  const webContents = window.webContents
  handle('web-undo', () => { if (!webLocked) webContents.undo() })
  handle('web-redo', () => { if (!webLocked) webContents.redo() })
  handle('web-cut', () => { if (!webLocked) webContents.cut() })
  handle('web-copy', () => { if (!webLocked) webContents.copy() })
  handle('web-paste', () => { if (!webLocked) webContents.paste() })
  handle('web-delete', () => { if (!webLocked) webContents.delete() })
  handle('web-select-all', () => { if (!webLocked) webContents.selectAll() })
  handle('web-reload', () => { if (!webLocked) webContents.reload() })
  handle('web-force-reload', () => { if (!webLocked) webContents.reloadIgnoringCache() })
  handle('web-toggle-devtools', () => { if (!webLocked) webContents.toggleDevTools() })
  handle('web-actual-size', () => webContents.setZoomLevel(0))
  handle('web-zoom-in', () => webContents.setZoomLevel(webContents.zoomLevel + 0.5))
  handle('web-zoom-out', () => webContents.setZoomLevel(webContents.zoomLevel - 0.5))
  handle('web-toggle-fullscreen', () => window.setFullScreen(!window.fullScreen))
  handle('web-open-url', (url: string) => shell.openExternal(url))

  window.webContents.on('before-input-event', (_event, input) => {
    if (!webLocked) return
    const isReloadCombo =
      (input.type === 'keyDown' &&
        ((input.control || input.meta) && !input.shift && input.key?.toLowerCase() === 'r')) ||
      (input.type === 'keyDown' && (input.key === 'F5' || input.code === 'F5'))
    if (isReloadCombo) {
      _event.preventDefault()
    }
  })
}
