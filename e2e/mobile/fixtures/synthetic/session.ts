import type { UserProfile } from '../../../../app/utils/api'
import { ok, type FixtureRoute } from '../types'
import { TITLE, VIEWER, type Person } from './people'

export const WEB_AUTH_KEY = 'utbt:webAuth:v1'

const NEVER_EXPIRES = Date.UTC(2100, 0, 1)

export function signedInStorage(viewer: Person = VIEWER): Record<string, string> {
    return {
        [WEB_AUTH_KEY]: JSON.stringify({
            discordId: viewer.id,
            username: viewer.alias.toLowerCase(),
            avatar: '',
            accessToken: 'synthetic-access-token',
            refreshToken: 'synthetic-refresh-token',
            expiresAt: NEVER_EXPIRES,
        }),
    }
}

export function sessionRoutes(role: number, viewer: Person = VIEWER, profile: Partial<UserProfile> = {}): FixtureRoute[] {
    const me: UserProfile & { twitch_url: string | null } = {
        discordId: viewer.id,
        username: viewer.alias.toLowerCase(),
        avatar: '',
        accessToken: 'synthetic-access-token',
        refreshToken: 'synthetic-refresh-token',
        expiresAt: NEVER_EXPIRES,
        id: viewer.id,
        alias: viewer.alias,
        utbt_role: role,
        active_title: TITLE,
        latest_activity: null,
        team: null,
        twitch_url: null,
        ...profile,
    }
    return [
        { host: 'api', path: '/users/me', reply: ok(me) },
        { host: 'api', path: '/user_state', reply: ok({ state: {}, seen: {}, updated_at: null }) },
    ]
}
