export const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please log in again.'
export const SESSION_UNCONFIRMED_MESSAGE = "We couldn't confirm your login right now, so you're browsing logged out. Reload the page to try again."

export class AuthRequestError extends Error {
    readonly status: number | null

    constructor(message: string, status: number | null) {
        super(message)
        this.name = 'AuthRequestError'
        this.status = status
    }
}

export function refreshFailureIsFinal(error: unknown): boolean {
    return error instanceof AuthRequestError && error.status !== null && error.status >= 400 && error.status < 500
}
