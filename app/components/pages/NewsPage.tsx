import { useMemo, useRef, useState } from 'react'
import { Loader2, AlertTriangle, Newspaper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAsync } from '@/app/hooks/useAsync'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import { useNavState } from '@/app/components/navigation/useNavState'
import { ArticleCard } from '@/app/components/pages/home/news/NewsCard'
import { fetchNews, fetchNewsCategories, type NewsArticle, type NewsCategoryDef, type UserProfile } from '@/app/utils/api'

interface NewsPageProps {
    userProfile?: UserProfile
}

export function NewsPage({ userProfile }: NewsPageProps) {
    const accessToken = userProfile?.accessToken ?? ''
    const refreshCooldown = useRefreshCooldown()
    const [refreshKey, setRefreshKey] = useState(0)
    const scrollRef = useRef<HTMLDivElement>(null)
    const [filter, setFilter] = useNavState<string>('news.filter', 'all')

    const { data, loading, error } = useAsync<{ news: NewsArticle[]; categories: NewsCategoryDef[] }>(
        async (signal) => {
            const [news, categories] = await Promise.all([
                fetchNews(accessToken!, signal),
                fetchNewsCategories(accessToken!, signal).catch(() => [] as NewsCategoryDef[]),
            ])
            return { news, categories }
        },
        [accessToken, refreshKey],
        { enabled: true, errorMessage: 'Failed to load the news feed.' },
    )

    const onScroll = useNavScrollRestore(scrollRef, !loading)

    useRegisterPageRefresh({
        onRefresh: () => refreshCooldown.trigger(() => setRefreshKey(k => k + 1)),
        refreshing: loading,
        disabled: !refreshCooldown.canRefresh,
        tooltip: refreshCooldown.canRefresh ? 'Refresh' : `Wait ${refreshCooldown.remainingSeconds}s`,
    })

    const items = useMemo(() => data?.news ?? [], [data])
    const categories = useMemo(() => data?.categories ?? [], [data])
    const categoryMap = useMemo(() => new Map(categories.map(c => [c.key, c])), [categories])

    const filtered = useMemo(
        () => (filter === 'all' ? items : items.filter(a => a.category === filter)),
        [items, filter],
    )

    return (
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-5">
                <header className="flex items-center gap-2.5">
                    <span className="h-5 w-1 rounded-full bg-accent-400 shrink-0" aria-hidden />
                    <h1 className="text-base font-black uppercase tracking-[0.14em] text-foreground">News</h1>
                </header>

                <div className="flex flex-wrap gap-2">
                    {[{ key: 'all', label: 'All' }, ...categories.map(c => ({ key: c.key, label: c.label }))].map(f => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            className={cn(
                                'px-3 py-1 rounded-md border text-xs font-semibold transition-colors cursor-pointer',
                                filter === f.key
                                    ? 'bg-accent-500/15 border-accent-500/40 text-accent-200'
                                    : 'bg-card/30 border-hairline/5 text-muted-foreground hover:text-foreground hover:border-hairline/15',
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {loading && items.length === 0 && (
                    <div className="flex items-center justify-center py-24 text-muted-foreground">
                        <Loader2 className="size-6 animate-spin" />
                    </div>
                )}

                {error && !loading && (
                    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                        <AlertTriangle className="size-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground font-medium">{error}</p>
                    </div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                        <Newspaper className="size-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground font-medium">No news to show.</p>
                    </div>
                )}

                {filtered.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {filtered.map(a => <ArticleCard key={a.id} article={a} category={categoryMap.get(a.category) ?? null} />)}
                    </div>
                )}
            </div>
        </div>
    )
}
