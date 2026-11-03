export type UserAgentOs = 'windows' | 'android' | 'ios' | 'macos' | 'chromeos' | 'linux' | 'unknown'

const MIN_INSTALLER_WINDOWS_NT_MAJOR = 10

export function userAgentOs(ua: string): UserAgentOs {
    if (/Windows/.test(ua)) return 'windows'
    if (/Android/.test(ua)) return 'android'
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
    if (/Mac OS/.test(ua)) return 'macos'
    if (/CrOS/.test(ua)) return 'chromeos'
    if (/Linux/.test(ua)) return 'linux'
    return 'unknown'
}

export function canRunDesktopInstaller(ua: string): boolean {
    if (/Windows Phone|Windows Mobile/.test(ua)) return false
    const match = /Windows NT (\d+)\.\d+/.exec(ua)
    return match !== null && Number(match[1]) >= MIN_INSTALLER_WINDOWS_NT_MAJOR
}
