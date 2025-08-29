import { app, type BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'

export const registerAppHandlers = (_window: BrowserWindow) => {
  handle('version', () => app.getVersion())
}
