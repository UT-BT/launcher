import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join } from 'path'
import { camFpsOf, camVolumeOf, type CamFps } from '@/lib/stream-kit/cam-plan'
import { loggingService } from './logging-service'

const ENC_PREFIX = 'enc:'

function encryptSecret(value: string): string {
  return value ? ENC_PREFIX + safeStorage.encryptString(value).toString('base64') : value
}

function holdsPlaintextToken(auth: AuthConfig | undefined): boolean {
  return [auth?.accessToken, auth?.refreshToken].some(
    (token) => typeof token === 'string' && token !== '' && !token.startsWith(ENC_PREFIX)
  )
}

function decryptSecret(value: string): string {
  if (value.startsWith(ENC_PREFIX)) {
    try {
      return safeStorage.decryptString(Buffer.from(value.slice(ENC_PREFIX.length), 'base64'))
    } catch {
      return ''
    }
  }
  return value
}

type InstalledPatch = {
  tag: string
  sha256: string
  installedAt: string
}

type GatewayConfig = {
  baseUrl: string
  apiKey?: string
}

type LauncherConfig = {
  ut99InstallPath?: string
  installedPatch?: InstalledPatch
  gateway?: GatewayConfig
  auth?: AuthConfig
  demoWatcher?: DemoWatcherConfig
  activeProfile?: string
  windowBehavior?: WindowBehaviorConfig
  camFps?: CamFps
  camVolume?: number
  legacyInstallDismissedVersion?: string
}

const CONFIG_FILE_NAME = 'config.json'

function getConfigDir(): string {
  const dir = join(app.getPath('userData'), 'config')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILE_NAME)
}

export function readConfig(): LauncherConfig {
  try {
    const file = getConfigPath()
    if (!existsSync(file)) {
      return {}
    }
    const raw = readFileSync(file, 'utf-8')
    const stored = JSON.parse(raw) as LauncherConfig & { updater?: unknown }
    const plaintextAuth = holdsPlaintextToken(stored.auth)
    if (!('updater' in stored) && !plaintextAuth) {
      return stored
    }
    const { updater: _updater, ...config } = stored
    if (plaintextAuth) {
      delete config.auth
    }
    try {
      writeConfig(config)
      if (plaintextAuth) {
        loggingService.warn('Removed a sign-in an earlier version saved without encryption; sign in again', 'Config')
      }
    } catch {
      // Keep the rest of the config usable if legacy-key cleanup cannot be persisted yet.
    }
    return config
  } catch {
    return {}
  }
}

export function writeConfig(config: LauncherConfig): void {
  const file = getConfigPath()
  const serialized = JSON.stringify(config, null, 2)
  const tmp = `${file}.tmp`
  writeFileSync(tmp, serialized, 'utf-8')
  renameSync(tmp, file)
}

export function getUt99InstallPath(): string | undefined {
  return readConfig().ut99InstallPath
}

export function setUt99InstallPath(path: string | undefined): void {
  const current = readConfig()
  const pathChanged = current.ut99InstallPath !== path
  const next: LauncherConfig = {
    ...current,
    ut99InstallPath: path,
    ...(pathChanged ? { installedPatch: undefined } : {}),
  }
  writeConfig(next)
}

export function setInstalledPatch(patch: InstalledPatch | undefined): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, installedPatch: patch }
  writeConfig(next)
}

export function markFreshInstall(): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, installedPatch: undefined }
  writeConfig(next)
}

export function getInstalledPatch(): InstalledPatch | undefined {
  return readConfig().installedPatch
}

export function getLegacyInstallDismissedVersion(): string | undefined {
  return readConfig().legacyInstallDismissedVersion
}

export function setLegacyInstallDismissedVersion(version: string): void {
  writeConfig({ ...readConfig(), legacyInstallDismissedVersion: version })
}

export function getGatewayConfig(): GatewayConfig {
  const config = readConfig()
  return config.gateway ?? {
    baseUrl: 'https://gateway.utbt.net',
  }
}

export function setGatewayConfig(gateway: Partial<GatewayConfig>): void {
  const current = readConfig()
  const currentGateway = current.gateway ?? { baseUrl: 'https://gateway.utbt.net' }
  const next: LauncherConfig = {
    ...current,
    gateway: { ...currentGateway, ...gateway }
  }
  writeConfig(next)
}

export function getGatewayBaseUrl(): string {
  return getGatewayConfig().baseUrl
}

export function setGatewayBaseUrl(baseUrl: string): void {
  setGatewayConfig({ baseUrl })
}

export function getGatewayApiKey(): string | undefined {
  return getGatewayConfig().apiKey
}

export function setGatewayApiKey(apiKey: string | undefined): void {
  setGatewayConfig({ apiKey })
}


export type AuthConfig = {
  discordId: string
  username: string
  avatar: string
  accessToken: string
  refreshToken: string
  expiresAt: number
}

let sessionAuth: AuthConfig | undefined
let sessionOnlyLogged = false

function canStoreTokens(): boolean {
  if (safeStorage.isEncryptionAvailable()) return true
  if (!sessionOnlyLogged) {
    sessionOnlyLogged = true
    loggingService.warn(
      'Encryption is unavailable on this machine; sign-ins are kept in memory for this session only',
      'Config'
    )
  }
  return false
}

export function getAuthConfig(): AuthConfig | undefined {
  if (!canStoreTokens()) return sessionAuth
  const auth = readConfig().auth
  if (!auth) return undefined
  return {
    ...auth,
    accessToken: decryptSecret(auth.accessToken),
    refreshToken: decryptSecret(auth.refreshToken),
  }
}

export function setAuthConfig(auth: AuthConfig): void {
  if (!canStoreTokens()) {
    sessionAuth = auth
    removeStoredAuth()
    return
  }
  const current = readConfig()
  const stored: AuthConfig = {
    ...auth,
    accessToken: encryptSecret(auth.accessToken),
    refreshToken: encryptSecret(auth.refreshToken),
  }
  writeConfig({ ...current, auth: stored })
}

export function clearAuthConfig(): void {
  sessionAuth = undefined
  removeStoredAuth()
}

function removeStoredAuth(): void {
  const { auth, ...rest } = readConfig()
  if (auth) writeConfig(rest)
} export type DemoWatcherConfig = {
  autoUpload: 'Never' | 'Personal Bests Only' | 'World Records Only'
  postUploadAction: 'Do Nothing' | 'Move to Folder' | 'Delete'
  discardDemoAction: 'Do Nothing' | 'Move to Folder' | 'Delete'
}

const AUTO_UPLOAD_VALUES = ['Never', 'Personal Bests Only', 'World Records Only'] as const
const DEMO_ACTION_VALUES = ['Do Nothing', 'Move to Folder', 'Delete'] as const

function pickEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback
}

export function getDemoWatcherConfig(): DemoWatcherConfig {
  const stored = (readConfig().demoWatcher ?? {}) as Partial<DemoWatcherConfig>
  return {
    autoUpload: pickEnum(stored.autoUpload, AUTO_UPLOAD_VALUES, 'Never'),
    postUploadAction: pickEnum(stored.postUploadAction, DEMO_ACTION_VALUES, 'Do Nothing'),
    discardDemoAction: pickEnum(stored.discardDemoAction, DEMO_ACTION_VALUES, 'Do Nothing'),
  }
}

export function setDemoWatcherConfig(demoWatcher: DemoWatcherConfig): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, demoWatcher }
  writeConfig(next)
}

export function getActiveProfile(): string | undefined {
  return readConfig().activeProfile
}

export function setActiveProfile(name: string | undefined): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, activeProfile: name }
  writeConfig(next)
}

export type WindowBehaviorConfig = {
  minimizeAction: 'taskbar' | 'tray'
  closeAction: 'quit' | 'tray'
  startOnStartup: boolean
  startMinimized: boolean
  trayBalloonShown: boolean
}

const MINIMIZE_ACTION_VALUES = ['taskbar', 'tray'] as const
const CLOSE_ACTION_VALUES = ['quit', 'tray'] as const

export function getWindowBehavior(): WindowBehaviorConfig {
  const stored = (readConfig().windowBehavior ?? {}) as Partial<WindowBehaviorConfig>
  return {
    minimizeAction: pickEnum(stored.minimizeAction, MINIMIZE_ACTION_VALUES, 'taskbar'),
    closeAction: pickEnum(stored.closeAction, CLOSE_ACTION_VALUES, 'quit'),
    startOnStartup: stored.startOnStartup === true,
    startMinimized: stored.startMinimized === true,
    trayBalloonShown: stored.trayBalloonShown === true,
  }
}

export function setWindowBehavior(behavior: Partial<WindowBehaviorConfig>): void {
  const current = readConfig()
  const next: LauncherConfig = {
    ...current,
    windowBehavior: { ...getWindowBehavior(), ...behavior },
  }
  writeConfig(next)
}

export function getCamFps(): CamFps {
  return camFpsOf(readConfig().camFps)
}

export function setCamFps(fps: CamFps): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, camFps: camFpsOf(fps) }
  writeConfig(next)
}

export function getCamVolume(): number {
  return camVolumeOf(readConfig().camVolume)
}

export function setCamVolume(volume: number): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, camVolume: camVolumeOf(volume) }
  writeConfig(next)
}
