import type { NewsArticle } from './types'
import type { Summary } from '@/app/utils/api'

type LatestPatch = NonNullable<Summary['latestPatch']>

export const MOCK_NEWS: NewsArticle[] = [
    {
        id: 'welcome-home',
        title: 'A fresh look for the homepage',
        excerpt: 'The launcher home has been rebuilt to match the rest of the app — a featured map, community stats, and the latest records at a glance.',
        tag: 'announcement',
        publishedAt: '2026-06-01T12:00:00Z',
        url: 'https://utbt.net',
    },
    {
        id: 'join-discord',
        title: 'Join the community on Discord',
        excerpt: 'Find people to play with, report bugs, and keep up with events and map releases.',
        tag: 'event',
        publishedAt: '2026-05-20T12:00:00Z',
        url: 'https://utbt.net',
    },
]

export function buildNewsFeed(latestPatch?: LatestPatch | null): NewsArticle[] {
    const feed: NewsArticle[] = import.meta.env.DEV ? [...MOCK_NEWS] : []
    if (latestPatch) {
        feed.push({
            id: `patch-${latestPatch.tag}`,
            title: `UTBT ${latestPatch.tag} is available`,
            excerpt: 'A new client update is ready. Install to get the latest features and fixes.',
            tag: 'update',
            publishedAt: latestPatch.added,
            url: latestPatch.release_notes_url,
            pinned: true,
            install: true,
        })
    }
    return feed.sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
}
