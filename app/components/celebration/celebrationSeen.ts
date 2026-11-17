import { getSynced, setSynced } from '@/app/utils/userState'

export const CELEBRATIONS_SEEN_KEY = 'utbt:celebrationsSeen:v1'

function seenSlugs(): string[] {
    const value = getSynced<unknown>(CELEBRATIONS_SEEN_KEY, [])
    return Array.isArray(value) ? value.filter((slug): slug is string => typeof slug === 'string') : []
}

export function hasSeenCelebration(slug: string): boolean {
    return seenSlugs().includes(slug)
}

export function markCelebrationSeen(slug: string): void {
    const seen = seenSlugs()
    if (!seen.includes(slug)) setSynced(CELEBRATIONS_SEEN_KEY, [...seen, slug])
}

export function isAutomatedBrowser(): boolean {
    return typeof navigator !== 'undefined' && navigator.webdriver === true
}
