import { API_BASE_URL } from '@/app/utils/api'
import type { AuthProfile, PlatformAuth } from '../auth'

const DISCORD_CLIENT_ID = '989441174022520842'
const DISCORD_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize'
const AUTH_STORAGE_KEY = 'utbt:webAuth:v1'
const FLOW_STORAGE_KEY = 'utbt:webAuthFlow:v1'
const REFRESH_MARGIN_MS = 5 * 60 * 1000

interface WebAuthFlowState {
    verifier: string
    state: string
    returnTo: string
}

interface TokenResponse {
    access_token: string
    token_type: string
    expires_in: number
    refresh_token: string
    scope: string
    user?: {
        id: string
        username: string
        avatar: string
    }
}

let loginError: string | null = null
let refreshPromise: Promise<AuthProfile> | null = null

function callbackRedirectUri(): string {
    return `${window.location.origin}/auth/callback`
}

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
    const random = new Uint8Array(32)
    crypto.getRandomValues(random)
    const verifier = base64UrlEncode(random)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
    return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) }
}

function readStoredProfile(): AuthProfile | undefined {
    try {
        const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
        if (!raw) return undefined
        const parsed = JSON.parse(raw) as AuthProfile
        if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.expiresAt) return undefined
        return parsed
    } catch {
        return undefined
    }
}

function persistProfile(profile: AuthProfile): boolean {
    try {
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile))
        return true
    } catch {
        return false
    }
}

async function postAuthEndpoint(path: string, body: Record<string, string>): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload?.success || !payload?.data?.access_token) {
        throw new Error(payload?.error || `Auth request failed with status ${response.status}`)
    }
    return payload.data as TokenResponse
}

async function startWebLogin(): Promise<AuthProfile | undefined> {
    const { verifier, challenge } = await generatePkce()
    const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)))
    const flow: WebAuthFlowState = {
        verifier,
        state,
        returnTo: `${window.location.pathname}${window.location.search}`,
    }
    window.sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(flow))

    const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: callbackRedirectUri(),
        response_type: 'code',
        scope: 'identify',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
    })
    window.location.assign(`${DISCORD_AUTHORIZE_URL}?${params.toString()}`)
    return new Promise<AuthProfile | undefined>(() => {})
}

export async function handleOAuthCallbackIfPresent(): Promise<void> {
    if (window.location.pathname !== '/auth/callback') return

    const query = new URLSearchParams(window.location.search)
    const rawFlow = window.sessionStorage.getItem(FLOW_STORAGE_KEY)
    window.sessionStorage.removeItem(FLOW_STORAGE_KEY)

    let returnTo = '/'
    try {
        const flow = rawFlow ? (JSON.parse(rawFlow) as WebAuthFlowState) : null
        if (flow?.returnTo && flow.returnTo.startsWith('/') && !flow.returnTo.startsWith('/auth/')) {
            returnTo = flow.returnTo
        }

        const error = query.get('error')
        const code = query.get('code')
        if (error) throw new Error(error === 'access_denied' ? 'Login was cancelled.' : `Discord returned: ${error}`)
        if (!code) throw new Error('Missing authorization code.')
        if (!flow?.verifier || !flow.state || query.get('state') !== flow.state) {
            throw new Error('Login session mismatch. Please try again.')
        }

        const tokens = await postAuthEndpoint('/auth/discord/token', {
            code,
            code_verifier: flow.verifier,
            redirect_uri: callbackRedirectUri(),
        })
        if (!tokens.user?.id) throw new Error('Login failed. Please try again.')

        const persisted = persistProfile({
            discordId: tokens.user.id,
            username: tokens.user.username,
            avatar: tokens.user.avatar,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: Date.now() + tokens.expires_in * 1000,
        })
        if (!persisted) throw new Error('Login succeeded, but this browser blocked local storage.')
    } catch (err) {
        loginError = err instanceof Error ? err.message : 'Login failed. Please try again.'
    } finally {
        window.history.replaceState(null, '', returnTo)
    }
}

async function performRefresh(profile: AuthProfile): Promise<AuthProfile> {
    const tokens = await postAuthEndpoint('/auth/discord/refresh', {
        refresh_token: profile.refreshToken,
    })
    const next: AuthProfile = {
        ...profile,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: Date.now() + tokens.expires_in * 1000,
    }
    if (!persistProfile(next)) {
        throw new Error('The refreshed login could not be saved.')
    }
    return next
}

async function getWebProfile(): Promise<AuthProfile | undefined> {
    const profile = readStoredProfile()
    if (!profile) return undefined

    if (Date.now() > profile.expiresAt - REFRESH_MARGIN_MS) {
        try {
            if (!refreshPromise) {
                refreshPromise = performRefresh(profile).finally(() => {
                    refreshPromise = null
                })
            }
            return await refreshPromise
        } catch (err) {
            if (Date.now() < profile.expiresAt) {
                console.warn('Web token refresh failed; using the still-valid stored token', err)
                return profile
            }
            window.localStorage.removeItem(AUTH_STORAGE_KEY)
            loginError = 'Your session expired. Please log in again.'
            return undefined
        }
    }

    return profile
}

export const webAuth: PlatformAuth = {
    login: startWebLogin,
    logout: () => {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
        return Promise.resolve()
    },
    getProfile: getWebProfile,
    consumeLoginError: () => {
        const error = loginError
        loginError = null
        return error
    },
}
