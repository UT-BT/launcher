import { BrowserWindow, shell, app } from 'electron'
import { join } from 'path'
import appIcon from '@/resources/build/icon.png?asset'
import { registerResourcesProtocol } from './protocols'
import { registerWindowHandlers } from '@/lib/conveyor/handlers/window-handler'
import { registerAppHandlers } from '@/lib/conveyor/handlers/app-handler'
import { registerGameHandlers } from '@/lib/conveyor/handlers/game-handler'
import { registerIniHandlers } from '@/lib/conveyor/handlers/ini-handler'
import { registerFavoritesHandlers, startBackgroundGamePoller } from '@/lib/conveyor/handlers/favorites-handler'
import { registerDemosHandlers } from '@/lib/conveyor/handlers/demos-handler'
import { demoWatcherService } from '@/lib/main/demo-watcher-service'
import windowStateKeeper from 'electron-window-state'

export function createAppWindow(): void {
  // Register custom protocol for resources
  registerResourcesProtocol()

  // Create the main window.
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 720,
  })

  const mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    show: true,
    backgroundColor: '#1c1c1c',
    icon: appIcon,
    frame: false,
    titleBarStyle: 'hiddenInset',
    title: 'UTBT.net',
    maximizable: true,
    resizable: true,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false,
    },
  })

  if (mainWindowState.isMaximized) {
    mainWindow.maximize()
  }
  mainWindowState.manage(mainWindow)

  registerWindowHandlers(mainWindow)
  registerAppHandlers(mainWindow)
  registerGameHandlers(mainWindow)
  registerIniHandlers(mainWindow)
  registerFavoritesHandlers(mainWindow)
  registerDemosHandlers(mainWindow)
  startBackgroundGamePoller(mainWindow)

  demoWatcherService.startWatching()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}