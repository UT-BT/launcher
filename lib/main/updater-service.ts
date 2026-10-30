import { app, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { loggingService } from './logging-service'
import { runStartupUpdate } from './startup-update'

const GITHUB_OWNER = 'UT-BT'
const GITHUB_REPO = 'launcher'
const STARTUP_CHECK_TIMEOUT_MS = 5_000
const STARTUP_DOWNLOAD_TIMEOUT_MS = 120_000
const INSTALL_HOLD_RELEASE_MS = 15_000
const FIRST_BACKGROUND_CHECK_DELAY_MS = 2_000
const BACKGROUND_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

export type UpdaterPhase =
  | 'idle'
  | 'checking'
  | 'not-available'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'

export type UpdaterState = {
  phase: UpdaterPhase
  version?: string
  releaseNotes?: string
  releaseDate?: string
  progressPercent?: number
  bytesPerSecond?: number
  transferred?: number
  total?: number
  error?: string
  currentVersion: string
  lastCheckTrigger: 'auto' | 'manual' | null
  lastCheckedAt?: string
  holdingLaunch: boolean
}

class UpdaterService {
  private mainWindow: BrowserWindow | null = null
  private state: UpdaterState
  private configured = false
  private lastTrigger: 'auto' | 'manual' = 'auto'
  private pendingDownload: Promise<boolean> | null = null
  private backgroundTimer: NodeJS.Timeout | null = null

  constructor() {
    this.state = {
      phase: 'idle',
      currentVersion: app.getVersion(),
      lastCheckTrigger: null,
      holdingLaunch: false,
    }
  }

  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
    this.configure()
  }

  getState(): UpdaterState {
    return { ...this.state }
  }

  async installBeforeLaunch(): Promise<boolean> {
    if (!app.isPackaged) return false
    this.configure()
    this.update({ holdingLaunch: true })
    const installing = await runStartupUpdate({
      check: () => this.check(false),
      download: () => this.download(),
      install: () => this.quitAndInstall(),
      checkTimeoutMs: STARTUP_CHECK_TIMEOUT_MS,
      downloadTimeoutMs: STARTUP_DOWNLOAD_TIMEOUT_MS,
    })
    if (installing) {
      setTimeout(() => this.update({ holdingLaunch: false }), INSTALL_HOLD_RELEASE_MS)
    } else {
      this.update({ holdingLaunch: false })
    }
    return installing
  }

  startBackgroundChecks(): void {
    if (this.backgroundTimer) return
    if (!app.isPackaged) {
      setTimeout(() => void this.backgroundCheck(), FIRST_BACKGROUND_CHECK_DELAY_MS)
    }
    this.backgroundTimer = setInterval(() => void this.backgroundCheck(), BACKGROUND_CHECK_INTERVAL_MS)
  }

  async check(manual: boolean): Promise<boolean> {
    this.configure()
    this.lastTrigger = manual ? 'manual' : 'auto'
    if (this.state.phase === 'checking' || this.state.phase === 'downloading') {
      return this.state.phase === 'downloading'
    }
    this.update({
      phase: 'checking',
      error: undefined,
      lastCheckTrigger: this.lastTrigger,
    })
    try {
      this.useDefaultFeed()
      const result = await autoUpdater.checkForUpdates()
      const available = result?.isUpdateAvailable === true
      if (available && app.isPackaged) {
        void this.download()
      }
      return available
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err)
      loggingService.error('checkForUpdates failed', 'Updater', { message: rawMessage })
      this.update({ phase: 'error', error: this.friendlyError(rawMessage) })
      return false
    }
  }

  download(): Promise<boolean> {
    if (this.state.phase === 'downloaded') return Promise.resolve(true)
    if (this.pendingDownload) return this.pendingDownload
    if (this.state.phase !== 'available') return Promise.resolve(false)
    this.update({ phase: 'downloading', progressPercent: 0 })
    this.pendingDownload = autoUpdater
      .downloadUpdate()
      .then(
        () => true,
        (err) => {
          const rawMessage = err instanceof Error ? err.message : String(err)
          loggingService.error('downloadUpdate failed', 'Updater', { message: rawMessage })
          this.update({ phase: 'error', error: this.friendlyError(rawMessage) })
          return false
        },
      )
      .finally(() => {
        this.pendingDownload = null
      })
    return this.pendingDownload
  }

  quitAndInstall(): void {
    if (this.state.phase !== 'downloaded') {
      return
    }
    this.update({ phase: 'installing' })
    autoUpdater.quitAndInstall(false, true)
  }

  private configure(): void {
    if (this.configured) return
    this.configured = true

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = app.isPackaged
    autoUpdater.allowPrerelease = false
    autoUpdater.logger = {
      info: (msg: unknown) => loggingService.info(String(msg), 'Updater'),
      warn: (msg: unknown) => loggingService.warn(String(msg), 'Updater'),
      error: (msg: unknown) => loggingService.error(String(msg), 'Updater'),
      debug: (msg: unknown) => loggingService.debug(String(msg), 'Updater'),
    }

    if (!app.isPackaged) {
      autoUpdater.forceDevUpdateConfig = true
    }

    this.wireEvents()
  }

  private async backgroundCheck(): Promise<void> {
    const busy: UpdaterPhase[] = ['checking', 'downloading', 'downloaded', 'installing']
    if (busy.includes(this.state.phase)) return
    await this.check(false)
  }

  private useDefaultFeed(): void {
    autoUpdater.setFeedURL({ provider: 'github', owner: GITHUB_OWNER, repo: GITHUB_REPO })
  }

  private wireEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.update({ phase: 'checking' })
    })

    autoUpdater.on('update-available', (info) => {
      this.update({
        phase: 'available',
        version: info.version,
        releaseNotes: this.normalizeReleaseNotes(info.releaseNotes),
        releaseDate: info.releaseDate,
        lastCheckedAt: new Date().toISOString(),
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      this.update({
        phase: 'not-available',
        version: info?.version,
        lastCheckedAt: new Date().toISOString(),
      })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.update({
        phase: 'downloading',
        progressPercent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.update({
        phase: 'downloaded',
        version: info.version,
        releaseNotes: this.normalizeReleaseNotes(info.releaseNotes),
        releaseDate: info.releaseDate,
        progressPercent: 100,
      })
    })

    autoUpdater.on('error', (err) => {
      const message = err instanceof Error ? err.message : String(err)
      loggingService.error('autoUpdater error', 'Updater', { message })
      this.update({ phase: 'error', error: this.friendlyError(message) })
    })
  }

  private normalizeReleaseNotes(notes: unknown): string | undefined {
    if (!notes) return undefined
    if (typeof notes === 'string') return this.stripAttribution(notes)
    if (Array.isArray(notes)) {
      const joined = notes
        .map((n) => {
          if (typeof n === 'string') return n
          if (n && typeof n === 'object' && 'note' in n) return String((n as { note?: string }).note ?? '')
          return ''
        })
        .filter(Boolean)
        .join('\n\n')
      return this.stripAttribution(joined)
    }
    return undefined
  }

  private stripAttribution(notes: string): string {
    return notes.replace(
      /\s+by\s+(?:<a\b[^>]*>)?@[\w-]+(?:<\/a>)?\s+in\s+(?:<a\b[^>]*>)?(?:#\d+|https?:\/\/[^\s<]+)(?:<\/a>)?/gi,
      '',
    )
  }

  private friendlyError(raw: string): string {
    if (/Cannot find latest\.yml/i.test(raw) && /404/.test(raw)) {
      return 'The latest release is missing update metadata (latest.yml). Please wait for a newer build.'
    }
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::|getaddrinfo/i.test(raw)) {
      return 'Could not reach GitHub to check for updates. Check your internet connection.'
    }
    if (/404/.test(raw)) {
      return 'Update metadata not found on GitHub (404).'
    }
    const firstLine = raw.split('\n')[0]?.trim() ?? raw
    return firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine
  }

  private update(patch: Partial<UpdaterState>): void {
    this.state = { ...this.state, ...patch }
    this.mainWindow?.webContents.send('updater:state-changed', this.state)
  }
}

export const updaterService = new UpdaterService()
