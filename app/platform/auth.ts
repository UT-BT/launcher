import type { AuthConfig } from '@/lib/main/config'
import { ApiError } from '@/app/utils/api'
import { IS_WEB } from './target'
import { webAuth } from './web/auth-web'

export type AuthProfile = AuthConfig

export type SessionRecovery =
    | { kind: 'refreshed'; profile: AuthProfile }
    | { kind: 'signedOut' }
    | { kind: 'unrecoverable' }

export interface PlatformAuth {
    login: () => Promise<AuthProfile | undefined>
    logout: () => Promise<void>
    getProfile: () => Promise<AuthProfile | undefined>
    consumeLoginError: () => string | null
    recoverRejectedSession: (profile: AuthProfile) => Promise<SessionRecovery>
}

const desktopAuth: PlatformAuth = {
    login: () => window.auth.login(),
    logout: () => window.auth.logout(),
    getProfile: () => window.auth.getProfile(),
    consumeLoginError: () => null,
    recoverRejectedSession: () => Promise.resolve({ kind: 'unrecoverable' }),
}

export const platformAuth: PlatformAuth = IS_WEB ? webAuth : desktopAuth

export function isRejectedSession(error: unknown): boolean {
    return error instanceof ApiError && error.status === 401
}
