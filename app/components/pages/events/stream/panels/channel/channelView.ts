export type ChannelChoice = 'mine' | 'utbt' | 'other'

export const OTHER_URL_MAX_LENGTH = 500

const TWITCH_LOGIN = /^[A-Za-z0-9_]{4,25}$/
const TWITCH_HOSTS = new Set(['twitch.tv', 'www.twitch.tv', 'm.twitch.tv'])

export const TWITCH_PROBLEM = 'Use a Twitch login (4 to 25 letters, digits or underscores), twitch.tv/<login> or a full twitch.tv link.'
export const OTHER_URL_PROBLEM = `Enter a link starting with http:// or https:// (at most ${OTHER_URL_MAX_LENGTH} characters).`
export const NO_CHANNEL_HINT = 'Set your Twitch channel below to use this.'

function twitchLoginOf(text: string): string | null {
    if (TWITCH_LOGIN.test(text)) return text
    let url: URL
    try {
        url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
    } catch {
        return null
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!TWITCH_HOSTS.has(url.hostname.toLowerCase())) return null
    const segments = url.pathname.replace(/^\/+|\/+$/g, '').split('/')
    return segments.length === 1 && TWITCH_LOGIN.test(segments[0]) ? segments[0] : null
}

export function normaliseTwitchInput(input: string): { url: string | null } | { problem: string } {
    const text = input.trim()
    if (!text) return { url: null }
    const login = twitchLoginOf(text)
    return login ? { url: `https://twitch.tv/${login.toLowerCase()}` } : { problem: TWITCH_PROBLEM }
}

export function otherUrlProblem(input: string): string | null {
    const text = input.trim()
    if (!text || text.length > OTHER_URL_MAX_LENGTH || /\s/.test(text)) return OTHER_URL_PROBLEM
    try {
        const url = new URL(text)
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname ? null : OTHER_URL_PROBLEM
    } catch {
        return OTHER_URL_PROBLEM
    }
}

export function currentLinkText(link: string | null): string {
    return link?.trim() ? link : 'No stream link set'
}
