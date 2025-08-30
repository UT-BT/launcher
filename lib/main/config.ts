import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

type LauncherConfig = {
  ut99InstallPath?: string
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
  const next: LauncherConfig = { ...current, ut99InstallPath: path }
  writeConfig(next)
}


