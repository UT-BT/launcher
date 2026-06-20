import { ExternalLink, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAddedDate } from '@/app/utils/format'
import { openNews } from '@/app/components/navigation/openNews'
import { getNewsIcon } from './icons'
import type { NewsArticle, NewsCategoryDef } from './types'

export type CategoryMap = Map<string, NewsCategoryDef>

function chipStyle(c: NewsCategoryDef) {
    const rgb = `${c.colorR}, ${c.colorG}, ${c.colorB}`
    return { backgroundColor: `rgba(${rgb}, 0.15)`, borderColor: `rgba(${rgb}, 0.4)`, color: `rgb(${rgb})` }
}

export function CategoryChip({ category }: { category?: NewsCategoryDef | null }) {
    if (!category) {
        return (
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-hairline/20 bg-card/40 text-muted-foreground text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0">
                News
            </span>
        )
    }
    const Icon = getNewsIcon(category.icon)
    return (
        <span style={chipStyle(category)} className="inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0">
            <Icon className="size-3 shrink-0" />
            {category.label}
        </span>
    )
}

function NewPill() {
    return (
        <span className="inline-flex items-center h-5 px-1.5 rounded bg-accent-500/20 border border-accent-500/50 text-accent-200 text-[9px] font-black uppercase tracking-wider">
            New
        </span>
    )
}

export function ArticleCard({ article, category, isNew }: { article: NewsArticle; category?: NewsCategoryDef | null; isNew?: boolean }) {
    const open = () => openNews(article.id)
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
            className="group bg-card/30 border border-hairline/5 rounded-xl overflow-hidden cursor-pointer transition-colors hover:border-hairline/15 hover:bg-card/40"
        >
            <div className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <CategoryChip category={category} />
                        {isNew && <NewPill />}
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{formatAddedDate(article.publishedAt)}</span>
                </div>
                <p className="text-base font-semibold text-foreground leading-snug">{article.title}</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{article.excerpt}</p>
                <div className="flex items-center gap-3 pt-1">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        Read more
                        <ArrowRight className="size-3" />
                    </span>
                    {article.linkUrl && (
                        <a
                            href={article.linkUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {article.linkText?.trim() || 'Open link'}
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
    categories?: CategoryMap
    newSince?: string | null
    className?: string
}

export function NewsCard({ articles, categories, newSince, className }: NewsCardProps) {
    if (articles.length === 0) return null
    return (
        <div className={cn('space-y-3', className)}>
            {articles.map(a => (
                <ArticleCard
                    key={a.id}
                    article={a}
                    category={categories?.get(a.category) ?? null}
                    isNew={!!newSince && a.publishedAt > newSince}
                />
            ))}
        </div>
    )
}
