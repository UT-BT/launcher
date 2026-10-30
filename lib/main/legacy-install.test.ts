import { describe, expect, it } from 'vitest'
import {
  isLauncherOnlyFolder,
  pinsInto,
  planLegacyRemoval,
  readRegistryValue,
  uninstallerPathOf,
  type FolderEntry,
  type LegacyRemovalInput,
} from './legacy-install'

const INSTALL_DIR = 'C:\\Program Files\\UTBT.net\\UTBT'

const file = (name: string): FolderEntry => ({ name, isDirectory: false })
const dir = (name: string): FolderEntry => ({ name, isDirectory: true })

const REAL_INSTALL: FolderEntry[] = [
  file('LICENSE.electron.txt'),
  file('LICENSES.chromium.html'),
  file('Uninstall utbt.exe'),
  file('chrome_100_percent.pak'),
  file('chrome_200_percent.pak'),
  file('d3dcompiler_47.dll'),
  file('dxcompiler.dll'),
  file('dxil.dll'),
  file('ffmpeg.dll'),
  file('icudtl.dat'),
  file('libEGL.dll'),
  file('libGLESv2.dll'),
  dir('locales'),
  dir('resources'),
  file('resources.pak'),
  file('snapshot_blob.bin'),
  file('uninstallerIcon.ico'),
  file('utbt.exe'),
  file('v8_context_snapshot.bin'),
  file('vk_swiftshader.dll'),
  file('vk_swiftshader_icd.json'),
  file('vulkan-1.dll'),
]

function input(overrides: Partial<LegacyRemovalInput> = {}): LegacyRemovalInput {
  return {
    uninstallString: `"${INSTALL_DIR}\\Uninstall utbt.exe" /allusers`,
    installLocation: INSTALL_DIR,
    entries: REAL_INSTALL,
    runningExe: 'C:\\Users\\player\\AppData\\Local\\Programs\\utbt-launcher\\utbt.exe',
    ...overrides,
  }
}

describe('readRegistryValue', () => {
  const output = [
    '',
    'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ae816db8-6f2b-5b8b-9801-0586483d6231',
    `    UninstallString    REG_SZ    "${INSTALL_DIR}\\Uninstall utbt.exe" /allusers`,
    '',
  ].join('\r\n')

  it('reads a string value from reg query output', () => {
    expect(readRegistryValue(output, 'UninstallString')).toBe(`"${INSTALL_DIR}\\Uninstall utbt.exe" /allusers`)
  })

  it('matches the value name without regard to case', () => {
    expect(readRegistryValue(output, 'uninstallstring')).not.toBeNull()
  })

  it('returns null for a value that is not there', () => {
    expect(readRegistryValue(output, 'InstallLocation')).toBeNull()
  })
})

describe('uninstallerPathOf', () => {
  it('takes the quoted executable and drops the arguments', () => {
    expect(uninstallerPathOf(`"${INSTALL_DIR}\\Uninstall utbt.exe" /allusers`)).toBe(`${INSTALL_DIR}\\Uninstall utbt.exe`)
  })

  it('refuses an unquoted command line', () => {
    expect(uninstallerPathOf('C:\\uninstall.exe /allusers')).toBeNull()
  })
})

describe('isLauncherOnlyFolder', () => {
  it('accepts a real all-users install', () => {
    expect(isLauncherOnlyFolder(REAL_INSTALL, 'Uninstall utbt.exe')).toBe(true)
  })

  it('accepts files from other Electron versions', () => {
    expect(isLauncherOnlyFolder([...REAL_INSTALL, file('vk_swiftshader_old.dll'), dir('swiftshader')], 'Uninstall utbt.exe')).toBe(true)
  })

  it.each([
    ['a game folder', dir('UnrealTournament')],
    ['a demos folder', dir('Demos')],
    ['a stray note', file('notes.txt')],
    ['a stray executable', file('UnrealTournament.exe')],
    ['a saved config', file('settings.json')],
  ])('refuses a folder that also holds %s', (_label, entry) => {
    expect(isLauncherOnlyFolder([...REAL_INSTALL, entry], 'Uninstall utbt.exe')).toBe(false)
  })
})

describe('planLegacyRemoval', () => {
  it('removes a plain all-users install', () => {
    expect(planLegacyRemoval(input())).toEqual({
      action: 'remove',
      uninstaller: `${INSTALL_DIR}\\Uninstall utbt.exe`,
      installDir: INSTALL_DIR,
    })
  })

  it('does nothing when there is no all-users install', () => {
    expect(planLegacyRemoval(input({ uninstallString: null }))).toEqual({ action: 'none' })
  })

  it('does nothing when the install folder is already gone', () => {
    expect(planLegacyRemoval(input({ entries: null }))).toEqual({ action: 'none' })
  })

  it('leaves it when the uninstaller lives outside the install folder', () => {
    expect(planLegacyRemoval(input({ uninstallString: '"D:\\Elsewhere\\Uninstall utbt.exe" /allusers' }))).toEqual({
      action: 'skip',
      reason: 'unexpected-uninstaller',
    })
  })

  it('leaves it when the uninstaller file is missing from the folder', () => {
    const entries = REAL_INSTALL.filter((entry) => entry.name !== 'Uninstall utbt.exe')
    expect(planLegacyRemoval(input({ entries }))).toEqual({ action: 'skip', reason: 'unexpected-uninstaller' })
  })

  it('never removes the install it is running from', () => {
    expect(planLegacyRemoval(input({ runningExe: `${INSTALL_DIR.toLowerCase()}\\utbt.exe` }))).toEqual({
      action: 'skip',
      reason: 'running-from-legacy',
    })
  })

  it('leaves a custom folder that holds anything besides the launcher', () => {
    const customDir = 'D:\\Games\\UTBT'
    expect(planLegacyRemoval(input({
      uninstallString: `"${customDir}\\Uninstall utbt.exe" /allusers`,
      installLocation: customDir,
      entries: [...REAL_INSTALL, dir('UnrealTournament')],
    }))).toEqual({ action: 'skip', reason: 'foreign-files' })
  })

  it('treats a trailing backslash on the install location as the same folder', () => {
    expect(planLegacyRemoval(input({ installLocation: `${INSTALL_DIR}\\` }))).toMatchObject({ action: 'remove' })
  })
})

describe('pinsInto', () => {
  it('spots a taskbar pin that opens the old install', () => {
    expect(pinsInto(['C:\\Windows\\explorer.exe', `${INSTALL_DIR}\\utbt.exe`], INSTALL_DIR)).toBe(true)
  })

  it('ignores pins that open the new install or nothing', () => {
    expect(pinsInto(['', 'C:\\Users\\player\\AppData\\Local\\Programs\\utbt-launcher\\utbt.exe'], INSTALL_DIR)).toBe(false)
  })

  it('does not mistake a sibling folder with a longer name for the old install', () => {
    expect(pinsInto([`${INSTALL_DIR}Old\\utbt.exe`], INSTALL_DIR)).toBe(false)
  })
})
