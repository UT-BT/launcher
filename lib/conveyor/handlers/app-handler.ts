import { app, type BrowserWindow } from 'electron'
import os from 'os'
import { handle } from '@/lib/main/shared'
import {
  getGatewayConfig,
  setGatewayConfig,
  getUt99InstallPath,
  setUt99InstallPath,
  getInstalledPatch,
  setInstalledPatch,
  getDemoWatcherConfig,
  setDemoWatcherConfig
} from '@/lib/main/config'
import { loggingService } from '@/lib/main/logging-service'
import { installationService } from '@/lib/main/installation-service'
import { gameService } from '@/lib/main/game-service'
import { patchService } from '@/lib/main/patch-service'
import { demoWatcherService } from '@/lib/main/demo-watcher-service'

export const registerAppHandlers = (_window: BrowserWindow) => {
  loggingService.info('Registering app IPC handlers', 'MainProcess')

  handle('version', () => {
    const version = app.getVersion()
    loggingService.debug('Version requested', 'MainProcess', { version })
    return version
  })

  handle('getOSInfo', () => {
    return {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch()
    }
  })


  handle('getGatewayConfig', () => getGatewayConfig())
  handle('setGatewayConfig', (config: { baseUrl?: string; apiKey?: string }) => setGatewayConfig(config))

  handle('getDemoWatcherConfig', () => getDemoWatcherConfig())
  handle('setDemoWatcherConfig', (config: any) => {
    setDemoWatcherConfig(config)
    demoWatcherService.restart()
  })

  handle('getUt99InstallPath', () => getUt99InstallPath())
  handle('setUt99InstallPath', (path: string | undefined) => {
    setUt99InstallPath(path)
    demoWatcherService.restart()
  })

  handle('getInstalledPatch', () => getInstalledPatch())
  handle('setInstalledPatch', (patch: any) => setInstalledPatch(patch))

  handle('logMessage', (level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: string, data?: any) => {
    loggingService.log(level, message, context, data)
  })

  handle('getLogFilePath', () => {
    const logPath = loggingService.getLogFilePath()
    loggingService.debug('Log file path requested', 'MainProcess', { logPath })
    return logPath
  })

  handle('getRecentLogs', (lines?: number) => {
    const logs = loggingService.getRecentLogs(lines)
    loggingService.debug('Recent logs requested', 'MainProcess', { lines, count: logs.length })
    return logs
  })

  handle('downloadUt99Iso', () => installationService.downloadISO(_window))
  handle('cancelUt99Download', () => installationService.cancelDownload())
  handle('mountAndRunUt99Iso', () => installationService.mountAndRun())

  handle('selectInstallDirectory', () => gameService.selectInstallDirectory(_window))
  handle('validateAndSetInstallPath', (path: string) => gameService.validateAndSetInstallPath(path, _window))
  handle('validateCurrentInstallation', () => gameService.validateCurrentInstallation())

  handle('fetchPatches', () => patchService.fetchPatches())
  handle('installPatch', (patch: any) => patchService.installPatch(patch, _window))

  handle('createProfile', async (name: string, path: string) => {
    await gameService.createProfile(name, path)
    _window.webContents.send('profile-changed')
  })
  handle('getProfiles', () => gameService.listProfiles())
  handle('switchProfile', async (name: string) => {
    await gameService.switchProfile(name)
    _window.webContents.send('profile-changed')
  })
  handle('deleteProfile', (name: string) => gameService.deleteProfile(name))
  handle('renameProfile', (oldName: string, newName: string) => gameService.renameProfile(oldName, newName))
  handle('getActiveProfile', () => gameService.getActiveProfile())
  handle('checkProfileSync', (name: string) => gameService.checkProfileSync(name))

  handle('getUploadLogs', () => demoWatcherService.getUploadLogs())
  handle(
    'addUploadLog',
    (entry: {
      filename: string
      status: 'success' | 'failed' | 'uploading'
      timestamp: string
      error?: string
    }) => demoWatcherService.addLogEntry(entry)
  )
  handle(
    'updateUploadLogStatus',
    (filename: string, status: 'success' | 'failed', error?: string) =>
      demoWatcherService.updateLogStatus(filename, status, error)
  )
  handle('extractBtpogId', (filePath: string) => demoWatcherService.extractBtpogId(filePath))
}
