import { BrowserWindow, shell, app, session } from 'electron'
import { join } from 'path'
import appIcon from '@/resources/build/icon.png?asset'
import { registerResourcesProtocol } from './protocols'
import { registerWindowHandlers } from '@/lib/conveyor/handlers/window-handler'
import { registerAppHandlers } from '@/lib/conveyor/handlers/app-handler'
import { registerGameHandlers } from '@/lib/conveyor/handlers/game-handler'
import { registerIniHandlers } from '@/lib/conveyor/handlers/ini-handler'
import { registerFavoritesHandlers, startBackgroundGamePoller } from '@/lib/conveyor/handlers/favorites-handler'
import { registerDemosHandlers } from '@/lib/conveyor/handlers/demos-handler'
import { registerUpdaterHandlers } from '@/lib/conveyor/handlers/updater-handler'
import { demoWatcherService } from '@/lib/main/demo-watcher-service'
import { updaterService } from '@/lib/main/updater-service'
import windowStateKeeper from 'electron-window-state'

export function createAppWindow(): void {
  // Register custom protocol for resources
  registerResourcesProtocol()

  const scriptSrc = app.isPackaged ? "'self'" : "'self' 'unsafe-inline' 'unsafe-eval'"
  const connectSrc = app.isPackaged
    ? "'self' https://gateway.utbt.net https://api.utbt.net"
    : "'self' https://gateway.utbt.net http://localhost:5000 http://127.0.0.1:5000 ws://localhost:5173"
  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: res: https://utbt.net https://gateway.utbt.net https://flagcdn.com https://cdn.discordapp.com",
    `connect-src ${connectSrc}`,
  ].join('; ')

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

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
      devTools: !app.isPackaged,
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
  registerUpdaterHandlers(mainWindow)
  startBackgroundGamePoller(mainWindow)

  demoWatcherService.startWatching()
  updaterService.init(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    setTimeout(() => {
      void updaterService.check(false)
    }, 2000)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow same-origin navigation (reloads, in-app routing); only divert
    // navigations to a different (external web) origin out to the browser.
    try {
      if (new URL(url).origin === new URL(mainWindow.webContents.getURL()).origin) {
        return
      }
    } catch {
      // fall through and block unparseable targets
    }
    event.preventDefault()
    shell.openExternal(url)
  })

  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}