import { app, shell } from 'electron'
import { execFile } from 'child_process'
import { readdir } from 'fs/promises'
import { dirname, join, win32 } from 'path'
import { promisify } from 'util'
import { loggingService } from './logging-service'
import { getLegacyInstallDismissedVersion, setLegacyInstallDismissedVersion } from './config'
import { LEGACY_INSTALL_KEY, pinsInto, planLegacyRemoval, readRegistryValue, type FolderEntry, type LegacyRemovalPlan } from './legacy-install'
import type { LegacyInstallStatus, LegacyRemovalResult } from '@/lib/conveyor/schemas/legacy-install-schema'

const run = promisify(execFile)

const UNINSTALL_KEY = `SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${LEGACY_INSTALL_KEY}`
const INSTALL_KEY = `SOFTWARE\\${LEGACY_INSTALL_KEY}`
const REMOVAL_TIMEOUT_MS = 120_000
const REMOVAL_POLL_MS = 1_000

let loggedSkip = false
let pendingRemoval: Promise<LegacyRemovalResult> | null = null

async function readMachineValue(key: string, name: string): Promise<string | null> {
  try {
    const { stdout } = await run('reg.exe', ['query', `HKLM\\${key}`, '/v', name, '/reg:64'], { windowsHide: true })
    return readRegistryValue(stdout, name)
  } catch {
    return null
  }
}

async function listFolder(dir: string): Promise<FolderEntry[] | null> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }))
  } catch {
    return null
  }
}

async function taskbarPins(): Promise<{ path: string; target: string }[]> {
  const pinsDir = join(app.getPath('appData'), 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar')
  try {
    const names = await readdir(pinsDir)
    return names
      .filter((name) => name.toLowerCase().endsWith('.lnk'))
      .map((name) => {
        const path = join(pinsDir, name)
        try {
          return { path, target: shell.readShortcutLink(path).target }
        } catch {
          return { path, target: '' }
        }
      })
  } catch {
    return []
  }
}

async function repairTaskbarPins(installDir: string): Promise<boolean> {
  const stale = (await taskbarPins()).filter((pin) => pinsInto([pin.target], installDir))
  for (const pin of stale) {
    const repaired = shell.writeShortcutLink(pin.path, 'update', {
      target: process.execPath,
      cwd: dirname(process.execPath),
      icon: process.execPath,
      iconIndex: 0,
    })
    loggingService.info(repaired ? 'Pointed a taskbar pin at the new install' : 'Could not update a taskbar pin', 'LegacyInstall')
  }
  return stale.length > 0
}

async function startElevated(file: string, args: string[]): Promise<boolean> {
  const quote = (value: string) => `'${value.replace(/'/g, "''")}'`
  const command = `Start-Process -FilePath ${quote(file)} -ArgumentList ${args.map(quote).join(',')} -Verb RunAs -ErrorAction Stop`
  try {
    await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true })
    return true
  } catch {
    return false
  }
}

async function legacyInstallGone(): Promise<boolean> {
  const deadline = Date.now() + REMOVAL_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (!(await readMachineValue(UNINSTALL_KEY, 'UninstallString'))) return true
    await new Promise((resolve) => setTimeout(resolve, REMOVAL_POLL_MS))
  }
  return !(await readMachineValue(UNINSTALL_KEY, 'UninstallString'))
}

async function currentPlan(): Promise<LegacyRemovalPlan> {
  if (!app.isPackaged || process.platform !== 'win32') return { action: 'none' }

  const uninstallString = await readMachineValue(UNINSTALL_KEY, 'UninstallString')
  if (!uninstallString) return { action: 'none' }
  const installLocation = await readMachineValue(INSTALL_KEY, 'InstallLocation')
  const entries = installLocation ? await listFolder(installLocation) : null

  const plan = planLegacyRemoval({ uninstallString, installLocation, entries, runningExe: process.execPath })
  if (plan.action === 'skip' && !loggedSkip) {
    loggedSkip = true
    loggingService.info(`Leaving the all-users install in place (${plan.reason})`, 'LegacyInstall')
  }
  return plan
}

async function runRemoval(): Promise<LegacyRemovalResult> {
  const plan = await currentPlan()
  if (plan.action === 'none') return { outcome: 'gone' }
  if (plan.action === 'skip') return { outcome: 'failed' }

  setLegacyInstallDismissedVersion(app.getVersion())
  const wasPinned = pinsInto((await taskbarPins()).map((pin) => pin.target), plan.installDir)
  loggingService.info(`Removing the all-users install in ${plan.installDir}`, 'LegacyInstall')

  if (!(await startElevated(plan.uninstaller, ['/S', '/allusers']))) {
    loggingService.info('All-users uninstaller was declined or failed to start', 'LegacyInstall')
    return { outcome: 'declined' }
  }

  if (!(await legacyInstallGone())) {
    loggingService.info('All-users install is still there after the uninstaller ran', 'LegacyInstall')
    return { outcome: 'failed' }
  }
  loggingService.info('All-users install removed', 'LegacyInstall')
  const repaired = await repairTaskbarPins(plan.installDir)
  return { outcome: 'removed', pinLost: wasPinned && !repaired }
}

export async function getLegacyInstallStatus(): Promise<LegacyInstallStatus> {
  const plan = await currentPlan()
  if (plan.action !== 'remove') return { found: false }
  return {
    found: true,
    uninstallerName: win32.basename(plan.uninstaller),
    offer: getLegacyInstallDismissedVersion() !== app.getVersion(),
  }
}

export function dismissLegacyInstall(): void {
  setLegacyInstallDismissedVersion(app.getVersion())
}

export function removeLegacyInstall(): Promise<LegacyRemovalResult> {
  pendingRemoval ??= runRemoval().finally(() => {
    pendingRemoval = null
  })
  return pendingRemoval
}
