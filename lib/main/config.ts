import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join } from 'path'

const ENC_PREFIX = 'enc:'

function encryptSecret(value: string): string {
  if (value && safeStorage.isEncryptionAvailable()) {
    return ENC_PREFIX + safeStorage.encryptString(value).toString('base64')
  }
  return value
}

function decryptSecret(value: string): string {
  if (value.startsWith(ENC_PREFIX)) {
    if (!safeStorage.isEncryptionAvailable()) return ''
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
  updater?: UpdaterConfig
}

export type UpdaterConfig = {
  allowPrerelease: boolean
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
    return JSON.parse(raw) as LauncherConfig
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

export function getAuthConfig(): AuthConfig | undefined {
  const auth = readConfig().auth
  if (!auth) return undefined
  return {
    ...auth,
    accessToken: decryptSecret(auth.accessToken),
    refreshToken: decryptSecret(auth.refreshToken),
  }
}

export function setAuthConfig(auth: AuthConfig): void {
  const current = readConfig()
  const stored: AuthConfig = {
    ...auth,
    accessToken: encryptSecret(auth.accessToken),
    refreshToken: encryptSecret(auth.refreshToken),
  }
  writeConfig({ ...current, auth: stored })
}

export function clearAuthConfig(): void {
  const current = readConfig()
  const { auth: _auth, ...rest } = current
  writeConfig(rest)
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

export function getUpdaterConfig(): UpdaterConfig {
  const config = readConfig()
  return config.updater ?? { allowPrerelease: false }
}

export function setUpdaterConfig(updater: Partial<UpdaterConfig>): void {
  const current = readConfig()
  const currentUpdater = current.updater ?? { allowPrerelease: false }
  const next: LauncherConfig = {
    ...current,
    updater: { ...currentUpdater, ...updater },
  }
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
