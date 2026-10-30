import { type BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { loggingService } from '@/lib/main/logging-service'
import { dismissLegacyInstall, getLegacyInstallStatus, removeLegacyInstall } from '@/lib/main/legacy-install-service'

export const registerLegacyInstallHandlers = (_window: BrowserWindow) => {
  loggingService.info('Registering legacy install IPC handlers', 'MainProcess')

  handle('legacyInstall:getStatus', () => getLegacyInstallStatus())
  handle('legacyInstall:dismiss', () => dismissLegacyInstall())
  handle('legacyInstall:remove', () => removeLegacyInstall())
}
