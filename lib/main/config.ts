import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

type PatchChannel = 'stable' | 'rc'

type InstalledPatch = {
  tag: string
  sha256: string
  channel: PatchChannel
  installedAt: string
}

type LauncherConfig = {
  ut99InstallPath?: string
  patchChannel?: PatchChannel
  baseVersion?: string
  installedPatch?: InstalledPatch
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
    ...(pathChanged ? { baseVersion: undefined, installedPatch: undefined, patchChannel: 'stable' } : {}),
  }
  writeConfig(next)
}

export function getPatchChannel(): PatchChannel {
  const cfg = readConfig()
  return cfg.patchChannel ?? 'stable'
}

export function setPatchChannel(channel: PatchChannel): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, patchChannel: channel }
  writeConfig(next)
}

export function setInstalledPatch(patch: InstalledPatch | undefined): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, installedPatch: patch }
  writeConfig(next)
}

export function getInstalledPatch(): InstalledPatch | undefined {
  return readConfig().installedPatch
}

export function setBaseVersion(version: string | undefined): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, baseVersion: version }
  writeConfig(next)
}

export function getBaseVersion(): string | undefined {
  return readConfig().baseVersion
}

export function markFreshInstall(baseVersion: string = 'v432'): void {
  const current = readConfig()
  const next: LauncherConfig = { ...current, baseVersion, installedPatch: undefined }
  writeConfig(next)
}


