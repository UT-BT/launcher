import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

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
  writeFileSync(file, serialized, 'utf-8')
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
  return readConfig().auth
}

export function setAuthConfig(auth: AuthConfig): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, auth }
  writeConfig(next)
}

export function clearAuthConfig(): void {
  const current = readConfig()
  const { auth, ...rest } = current
  writeConfig(rest)
} export type DemoWatcherConfig = {
  autoUpload: 'Never' | 'Personal Bests Only' | 'World Records Only' | 'All Runs'
  postUploadAction: 'Do Nothing' | 'Move to Folder' | 'Delete'
}

export function getDemoWatcherConfig(): DemoWatcherConfig {
  const config = readConfig()
  return config.demoWatcher ?? {
    autoUpload: 'Never',
    postUploadAction: 'Do Nothing'
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
