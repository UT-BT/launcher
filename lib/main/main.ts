import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow } from './app'
import { trayService } from '@/lib/main/tray-service'
import { loggingService } from '@/lib/main/logging-service'

app.setName('UTBT')

process.on('unhandledRejection', (reason) => {
  loggingService.error('Unhandled promise rejection in main process', 'MainProcess', reason)
})
process.on('uncaughtException', (error) => {
  loggingService.error('Uncaught exception in main process', 'MainProcess', error)
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    trayService.showWindow()
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.utbt.launcher')
    // Create app window
    createAppWindow()
    loggingService.info('UTBT Launcher application started successfully', 'MainProcess')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        createAppWindow()
      }
    })
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file, you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

import { ipcMain } from 'electron'
import { authService } from '@/lib/main/auth-service'

ipcMain.handle('auth:login', () => authService.login())
ipcMain.handle('auth:logout', () => authService.logout())
ipcMain.handle('auth:get-profile', () => authService.getProfile())
