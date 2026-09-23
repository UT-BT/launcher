const STORAGE_KEY = 'utbt:devImpersonateUserId'

export const DEV_IMPERSONATE_EVENT = 'utbt:dev-impersonate'
export const IMPERSONATION_HEADER = 'X-UTBT-Impersonate-User'

export function getImpersonatedUserId(): string | null {
    if (!import.meta.env.DEV) return null
    try {
        return localStorage.getItem(STORAGE_KEY)
    } catch {
        return null
    }
}

export function setImpersonatedUserId(userId: string | null): void {
    if (!import.meta.env.DEV) return
    try {
        if (userId) {
            localStorage.setItem(STORAGE_KEY, userId)
        } else {
            localStorage.removeItem(STORAGE_KEY)
        }
    } catch {
        // best-effort dev convenience only
    }
}
