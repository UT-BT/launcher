import { describe, expect, it } from 'vitest'
import { ApiError } from '@/app/utils/api'
import { isRejectedSession } from '../auth'
import { AuthRequestError, refreshFailureIsFinal } from './sessionRecovery'

describe('isRejectedSession', () => {
    it('is true only when the API refuses the login token', () => {
        expect(isRejectedSession(new ApiError(401, 'Invalid authentication for this endpoint.', 'Unauthorized'))).toBe(true)
        expect(isRejectedSession(new ApiError(403, undefined, 'Forbidden'))).toBe(false)
        expect(isRejectedSession(new ApiError(500, undefined, 'Server error'))).toBe(false)
        expect(isRejectedSession(new TypeError('Failed to fetch'))).toBe(false)
    })
})

describe('refreshFailureIsFinal', () => {
    it('treats a refused refresh as a dead session', () => {
        expect(refreshFailureIsFinal(new AuthRequestError('invalid_grant', 400))).toBe(true)
        expect(refreshFailureIsFinal(new AuthRequestError('unauthorized', 401))).toBe(true)
    })

    it('keeps the session when the refresh could not be checked', () => {
        expect(refreshFailureIsFinal(new AuthRequestError('server error', 500))).toBe(false)
        expect(refreshFailureIsFinal(new AuthRequestError('bad gateway', 502))).toBe(false)
        expect(refreshFailureIsFinal(new AuthRequestError('offline', null))).toBe(false)
        expect(refreshFailureIsFinal(new Error('anything else'))).toBe(false)
    })
})
