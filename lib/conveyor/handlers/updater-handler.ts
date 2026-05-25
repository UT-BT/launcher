import { type BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { updaterService } from '@/lib/main/updater-service'
import { loggingService } from '@/lib/main/logging-service'

export const registerUpdaterHandlers = (_window: BrowserWindow) => {
  loggingService.info('Registering updater IPC handlers', 'MainProcess')

  handle('updater:check', (manual) => updaterService.check(manual ?? false))
  handle('updater:download', () => updaterService.download())
  handle('updater:quitAndInstall', () => updaterService.quitAndInstall())
  handle('updater:getState', () => updaterService.getState())
  handle('updater:setAllowPrerelease', (value) => updaterService.setAllowPrerelease(value))
}
