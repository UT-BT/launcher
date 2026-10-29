import { IS_WEB } from './target'
import {
    DESKTOP_CAPABILITIES,
    WEB_CAPABILITIES,
    type PlatformCapabilities,
} from './capabilities'
import { isRejectedSession, platformAuth, type AuthProfile, type PlatformAuth, type SessionRecovery } from './auth'
import { fetchGatewayPatrons, fetchGatewayServers } from './gateway'
import { openExternal } from './external'
import { saveDemoFile, saveMapZip, type DemoSaveResult, type MapSaveResult } from './downloads'

export const capabilities: PlatformCapabilities = IS_WEB ? WEB_CAPABILITIES : DESKTOP_CAPABILITIES

export const platform = {
    isWeb: IS_WEB,
    capabilities,
    auth: platformAuth,
    gateway: {
        fetchServers: fetchGatewayServers,
        fetchPatrons: fetchGatewayPatrons,
    },
    external: {
        openExternal,
    },
    downloads: {
        saveDemoFile,
        saveMapZip,
    },
} as const

export function usePlatform() {
    return platform
}

export { IS_WEB, platformAuth, isRejectedSession, openExternal, fetchGatewayServers, fetchGatewayPatrons, saveDemoFile, saveMapZip }
export type { PlatformCapabilities, AuthProfile, PlatformAuth, SessionRecovery, DemoSaveResult, MapSaveResult }
