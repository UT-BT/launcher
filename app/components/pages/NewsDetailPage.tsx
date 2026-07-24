import { useRef, useState } from 'react'
import { Loader2, AlertTriangle, ExternalLink, User } from 'lucide-react'
import { useAsync } from '@/app/hooks/useAsync'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import { useDocumentTitle } from '@/app/components/navigation/useDocumentMeta'
import { SITE_NAME } from '@/app/components/navigation/titles'
import { MarkdownBody } from '@/app/components/shared/MarkdownBody'
import { CategoryChip } from '@/app/components/pages/home/news/NewsCard'
import { formatAddedDate } from '@/app/utils/format'
import { fetchNewsItem, fetchNewsCategories, type NewsArticle, type NewsCategoryDef, type UserProfile } from '@/app/utils/api'

interface NewsDetailPageProps {
    newsId: number
    userProfile?: UserProfile
}

export function NewsDetailPage({ newsId, userProfile }: NewsDetailPageProps) {
    const accessToken = userProfile?.accessToken ?? ''
    const refreshCooldown = useRefreshCooldown()
    const [refreshKey, setRefreshKey] = useState(0)
    const scrollRef = useRef<HTMLDivElement>(null)

    const { data, loading, error } = useAsync<{ article: NewsArticle; categories: NewsCategoryDef[] }>(
        async (signal) => {
            const [article, categories] = await Promise.all([
                fetchNewsItem(accessToken!, newsId, signal),
                fetchNewsCategories(accessToken!, signal).catch(() => [] as NewsCategoryDef[]),
            ])
            return { article, categories }
        },
        [accessToken, newsId, refreshKey],
        { enabled: !!newsId, errorMessage: 'Failed to load this news item.' },
    )

    useDocumentTitle(data?.article?.title, SITE_NAME)

    const onScroll = useNavScrollRestore(scrollRef, !loading && !!data)

    useRegisterPageRefresh({
        onRefresh: () => refreshCooldown.trigger(() => setRefreshKey(k => k + 1)),
        refreshing: loading,
        disabled: !refreshCooldown.canRefresh,
        tooltip: refreshCooldown.canRefresh ? 'Refresh' : `Wait ${refreshCooldown.remainingSeconds}s`,
    })

    const article = data?.article
    const category = article ? (data?.categories.find(c => c.key === article.category) ?? null) : null

    return (
        <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto custom-scrollbar">
            <div className="p-6">
                {loading && !article && (
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

                {article && (
                    <article className="space-y-5">
                        <div className="flex flex-wrap items-center gap-3">
                            <CategoryChip category={category} />
                            <span className="text-xs text-muted-foreground tabular-nums">{formatAddedDate(article.publishedAt)}</span>
                            {article.authorAlias && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <User className="size-3" />
                                    {article.authorAlias}
                                </span>
                            )}
                        </div>

                        <h1 className="text-2xl font-black text-foreground leading-tight">{article.title}</h1>
                        <p className="text-base text-muted-foreground leading-relaxed">{article.excerpt}</p>

                        <div className="border-t border-hairline/5 pt-5">
                            <MarkdownBody className="text-sm">{article.body}</MarkdownBody>
                        </div>

                        {article.linkUrl && (
                            <a
                                href={article.linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60 transition-colors text-sm font-semibold"
                            >
                                {article.linkText?.trim() || 'Open link'}
                                <ExternalLink className="size-3.5" />
                            </a>
                        )}
                    </article>
                )}
            </div>
        </div>
    )
}
