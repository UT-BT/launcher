import type { AuthConfig } from '@/lib/main/config'
import { IS_WEB } from './target'

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

const webAuthStub: PlatformAuth = {
    login: () => Promise.reject(new Error('Web login is not available yet')),
    logout: () => Promise.resolve(),
    getProfile: () => Promise.resolve(undefined),
    consumeLoginError: () => null,
}

export const platformAuth: PlatformAuth = IS_WEB ? webAuthStub : desktopAuth
