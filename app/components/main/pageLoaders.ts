/**
 * One dynamic import per primary page, shared between Main's `lazy()` calls and
 * the prefetch helpers below. Both paths must go through the *same* function
 * reference so they resolve to the same module-registry entry -- duplicating the
 * `import()` expression would fetch the chunk twice.
 *
 * `home` is deliberately absent. It is the default view and the fallback for any
 * unrecognised path, so it stays in the entry chunk.
 */
export const PAGE_LOADERS = {
    servers: () => import('@/app/components/pages/ServerBrowserPage').then(m => ({ default: m.ServerBrowserPage })),
    maps: () => import('@/app/components/pages/MapsPage').then(m => ({ default: m.MapsPage })),
    players: () => import('@/app/components/pages/PlayersPage').then(m => ({ default: m.PlayersPage })),
    'cap-it-all': () => import('@/app/components/pages/CapItAllPage').then(m => ({ default: m.CapItAllPage })),
    'world-records': () => import('@/app/components/pages/WorldRecordsPage').then(m => ({ default: m.WorldRecordsPage })),
    achievements: () => import('@/app/components/pages/AchievementsPage').then(m => ({ default: m.AchievementsPage })),
    teams: () => import('@/app/components/pages/TeamsPage').then(m => ({ default: m.TeamsPage })),
    events: () => import('@/app/components/pages/EventsPage').then(m => ({ default: m.EventsPage })),
    news: () => import('@/app/components/pages/NewsPage').then(m => ({ default: m.NewsPage })),
}

const loaderByView: Record<string, (() => Promise<unknown>) | undefined> = PAGE_LOADERS

export function prefetchPage(view: string | undefined): void {
    if (!view) return
    void loaderByView[view]?.().catch(() => {})
}

/**
 * Desktop only. Chunks are local disk reads there, so warming all of them during
 * idle time restores the pre-split behaviour where every page was instant, while
 * still keeping them out of the entry chunk that the website has to parse.
 */
export function warmAllPages(): void {
    const schedule =
        typeof requestIdleCallback === 'function'
            ? (callback: () => void) => requestIdleCallback(callback)
            : (callback: () => void) => { setTimeout(callback, 200) }

    for (const load of Object.values(loaderByView)) {
        schedule(() => void load?.().catch(() => {}))
    }
}
