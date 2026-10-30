import { win32 } from 'path'

export const LEGACY_INSTALL_KEY = 'ae816db8-6f2b-5b8b-9801-0586483d6231'

export type FolderEntry = { name: string; isDirectory: boolean }

export type LegacySkipReason = 'unexpected-uninstaller' | 'running-from-legacy' | 'foreign-files'

export type LegacyRemovalPlan =
  | { action: 'none' }
  | { action: 'skip'; reason: LegacySkipReason }
  | { action: 'remove'; uninstaller: string; installDir: string }

export type LegacyRemovalInput = {
  uninstallString: string | null
  installLocation: string | null
  entries: FolderEntry[] | null
  runningExe: string
}

const LAUNCHER_DIRECTORIES = new Set(['locales', 'resources', 'swiftshader'])
const LAUNCHER_FILES = new Set([
  'utbt.exe',
  'license.electron.txt',
  'licenses.chromium.html',
  'vk_swiftshader_icd.json',
  'uninstallericon.ico',
])
const LAUNCHER_FILE_EXTENSIONS = new Set(['.dll', '.pak', '.bin', '.dat'])

export function readRegistryValue(output: string, name: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const match = /^\s+(\S+)\s+REG_(?:EXPAND_)?SZ\s+(.*)$/.exec(line)
    if (match && match[1].toLowerCase() === name.toLowerCase()) return match[2].trim()
  }
  return null
}

export function uninstallerPathOf(uninstallString: string): string | null {
  const quoted = /^"([^"]+)"/.exec(uninstallString.trim())
  return quoted ? quoted[1] : null
}

export function isLauncherOnlyFolder(entries: FolderEntry[], uninstallerName: string): boolean {
  const uninstaller = uninstallerName.toLowerCase()
  return entries.every((entry) => {
    const name = entry.name.toLowerCase()
    if (entry.isDirectory) return LAUNCHER_DIRECTORIES.has(name)
    return name === uninstaller || LAUNCHER_FILES.has(name) || LAUNCHER_FILE_EXTENSIONS.has(win32.extname(name))
  })
}

export function planLegacyRemoval(input: LegacyRemovalInput): LegacyRemovalPlan {
  if (!input.uninstallString || !input.installLocation || !input.entries) return { action: 'none' }

  const uninstaller = uninstallerPathOf(input.uninstallString)
  if (!uninstaller || !samePath(win32.dirname(uninstaller), input.installLocation)) {
    return { action: 'skip', reason: 'unexpected-uninstaller' }
  }
  const uninstallerName = win32.basename(uninstaller).toLowerCase()
  if (!input.entries.some((entry) => !entry.isDirectory && entry.name.toLowerCase() === uninstallerName)) {
    return { action: 'skip', reason: 'unexpected-uninstaller' }
  }
  if (isInside(input.installLocation, input.runningExe)) return { action: 'skip', reason: 'running-from-legacy' }
  if (!isLauncherOnlyFolder(input.entries, uninstallerName)) return { action: 'skip', reason: 'foreign-files' }

  return { action: 'remove', uninstaller, installDir: input.installLocation }
}

export function pinsInto(pinTargets: string[], folder: string): boolean {
  return pinTargets.some((target) => target !== '' && isInside(folder, target))
}

function normalise(path: string): string {
  return win32.resolve(path).toLowerCase()
}

function samePath(a: string, b: string): boolean {
  return normalise(a) === normalise(b)
}

function isInside(parent: string, child: string): boolean {
  const rel = win32.relative(normalise(parent), normalise(child))
  return rel === '' || (!rel.startsWith('..') && !win32.isAbsolute(rel))
}
