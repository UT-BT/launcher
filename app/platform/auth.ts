import type { AuthConfig } from '@/lib/main/config'
import { IS_WEB } from './target'
import { webAuth } from './web/auth-web'

export type AuthProfile = AuthConfig

export interface PlatformAuth {
    login: () => Promise<AuthProfile | undefined>
    logout: () => Promise<void>
    getProfile: () => Promise<AuthProfile | undefined>
    consumeLoginError: () => string | null
}

const desktopAuth: PlatformAuth = {
    login: () => window.auth.login(),
    logout: () => window.auth.logout(),
    getProfile: () => window.auth.getProfile(),
    consumeLoginError: () => null,
}

export const platformAuth: PlatformAuth = IS_WEB ? webAuth : desktopAuth
