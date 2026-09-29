export interface KitInfo {
    currentVersion: number
    downloadedVersion: number | null
    defaultFolder: string
}

export type KitBannerState = 'never-downloaded' | 'outdated' | 'current'

export function kitBannerState(info: Pick<KitInfo, 'currentVersion' | 'downloadedVersion'>): KitBannerState {
    if (info.downloadedVersion === null) return 'never-downloaded'
    return info.currentVersion > info.downloadedVersion ? 'outdated' : 'current'
}
