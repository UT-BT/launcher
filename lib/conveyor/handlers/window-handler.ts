import type { BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { openExternalSafe } from '@/lib/main/url-safety'
import { electronAPI } from '@electron-toolkit/preload'

export const registerWindowHandlers = (window: BrowserWindow) => {
  handle('window-init', () => {
    const { width, height } = window.getBounds()
    const minimizable = window.isMinimizable()
    const maximizable = window.isMaximizable()
    const platform = electronAPI.process.platform

    return { width, height, minimizable, maximizable, platform }
  })

  handle('window-minimize', () => window.minimize())
  handle('window-close', () => window.close())
  handle('window-maximize-toggle', () => (window.isMaximized() ? window.unmaximize() : window.maximize()))
  handle('web-open-url', (url: string) => openExternalSafe(url))
}
