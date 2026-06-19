import { Download, Megaphone, Calendar, Package, ExternalLink, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAddedDate } from '@/app/utils/format'
import type { NewsArticle, NewsTag } from './types'

const TAG_META: Record<NewsTag, { label: string; icon: LucideIcon; chip: string; iconColor: string }> = {
    update: { label: 'Update', icon: Download, chip: 'bg-blue-500/15 border-blue-500/40 text-blue-200', iconColor: 'text-blue-300' },
    event: { label: 'Event', icon: Calendar, chip: 'bg-purple-500/15 border-purple-500/40 text-purple-200', iconColor: 'text-purple-300' },
    announcement: { label: 'News', icon: Megaphone, chip: 'bg-accent-500/15 border-accent-500/40 text-accent-200', iconColor: 'text-accent-300' },
    mappack: { label: 'Map Pack', icon: Package, chip: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300', iconColor: 'text-emerald-300' },
}

function ArticleCard({ article, onInstall }: { article: NewsArticle; onInstall?: () => void }) {
    const meta = TAG_META[article.tag]
    const Icon = meta.icon
    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl overflow-hidden">
            {article.coverImageUrl && (
                <img src={article.coverImageUrl} alt="" loading="lazy" decoding="async" className="w-full aspect-video object-cover" />
            )}
            <div className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <span className={cn('inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[10px] font-bold uppercase tracking-wider', meta.chip)}>
                        <Icon className={cn('size-3', meta.iconColor)} />
                        {meta.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{formatAddedDate(article.publishedAt)}</span>
                </div>
                <p className="text-base font-semibold text-foreground leading-snug">{article.title}</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{article.excerpt}</p>
                <div className="flex items-center gap-3 pt-1">
                    {article.install && onInstall && (
                        <button
                            type="button"
                            onClick={onInstall}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60 transition-colors text-xs font-semibold cursor-pointer"
                        >
                            <Download className="size-3" />
                            Install
                        </button>
                    )}
                    {article.url && (
                        <a
                            href={article.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {article.install ? 'Release notes' : 'Read more'}
                            <ExternalLink className="size-3" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    )
}

interface NewsCardProps {
    articles: NewsArticle[]
    onInstall?: () => void
}

export function NewsCard({ articles, onInstall }: NewsCardProps) {
    if (articles.length === 0) return null
    return (
        <div className="space-y-3">
            {articles.map(a => <ArticleCard key={a.id} article={a} onInstall={onInstall} />)}
        </div>
    )
}
