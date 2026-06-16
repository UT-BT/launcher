import { app, Tray, Menu, nativeImage, type BrowserWindow } from 'electron'
import trayIcon from '@/resources/build/icon.ico?asset'
import { getWindowBehavior, setWindowBehavior, type WindowBehaviorConfig } from '@/lib/main/config'
import { gameService } from '@/lib/main/game-service'
import { loggingService } from '@/lib/main/logging-service'

class TrayService {
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null
  private isQuitting = false
  private config: WindowBehaviorConfig = getWindowBehavior()

  init(window: BrowserWindow): void {
    this.mainWindow = window
    this.config = getWindowBehavior()

    app.on('before-quit', () => {
      this.isQuitting = true
    })

    window.on('minimize', () => {
      if (this.config.minimizeAction === 'tray') {
        this.hideToTray()
      }
    })

    window.on('close', (event) => {
      if (!this.isQuitting && this.config.closeAction === 'tray') {
        event.preventDefault()
        this.hideToTray()
      }
    })

    this.applyConfig(this.config)
  }

  applyConfig(config: WindowBehaviorConfig): void {
    this.config = config

    const needsTray =
      config.minimizeAction === 'tray' ||
      config.closeAction === 'tray' ||
      (config.startOnStartup && config.startMinimized)

    if (needsTray) {
      this.ensureTray()
    } else {
      this.destroyTray()
    }

    this.applyAutoStart(config)
  }

  showWindow(): void {
    const window = this.mainWindow
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  ensureTray(): void {
    if (this.tray) return

    const image = nativeImage.createFromPath(trayIcon)
    this.tray = new Tray(image)
    this.tray.setToolTip('UTBT')
    this.tray.setContextMenu(this.buildMenu())
    this.tray.on('click', () => this.showWindow())
    this.tray.on('double-click', () => this.showWindow())
    loggingService.info('System tray icon created', 'TrayService')
  }

  shouldStartHidden(): boolean {
    return process.argv.includes('--hidden') && getWindowBehavior().startMinimized
  }

  private destroyTray(): void {
    if (!this.tray) return
    this.tray.destroy()
    this.tray = null
    loggingService.info('System tray icon removed', 'TrayService')
  }

  private buildMenu(): Menu {
    return Menu.buildFromTemplate([
      { label: 'Open UTBT', click: () => this.showWindow() },
      { label: 'Play', click: () => this.play() },
      { type: 'separator' },
      { label: 'Quit UTBT', click: () => app.quit() },
    ])
  }

  private play(): void {
    if (!gameService.canLaunch()) {
      this.showWindow()
      return
    }
    try {
      gameService.launchStandalone()
    } catch (error) {
      loggingService.error('Failed to launch game from tray', 'TrayService', error)
      this.showWindow()
    }
  }

  private hideToTray(): void {
    const window = this.mainWindow
    if (!window) return
    this.ensureTray()
    window.hide()
    this.maybeShowBalloon()
  }

  private maybeShowBalloon(): void {
    if (this.config.trayBalloonShown) return
    setWindowBehavior({ trayBalloonShown: true })
    this.config = { ...this.config, trayBalloonShown: true }

    if (process.platform === 'win32' && this.tray) {
      this.tray.displayBalloon({
        title: 'UTBT is still running',
        content: 'The launcher is in the system tray. Right-click the icon for options.',
      })
    }
  }

  private applyAutoStart(config: WindowBehaviorConfig): void {
    try {
      app.setLoginItemSettings({
        openAtLogin: config.startOnStartup,
        path: process.execPath,
        args: config.startMinimized ? ['--hidden'] : [],
      })
    } catch (error) {
      loggingService.error('Failed to apply login item settings', 'TrayService', error)
    }
  }
}

export const trayService = new TrayService()
