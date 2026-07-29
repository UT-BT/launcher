import { useLayoutEffect, useRef, useState, type Ref } from 'react'
import { ExternalLink, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAddedDate } from '@/app/utils/format'
import { openNews } from '@/app/components/navigation/openNews'
import { NavLink } from '@/app/components/navigation/NavLink'
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

export function ArticleCard({
    article,
    category,
    isNew,
    articleRef,
    className,
}: {
    article: NewsArticle
    category?: NewsCategoryDef | null
    isNew?: boolean
    articleRef?: Ref<HTMLDivElement>
    className?: string
}) {
    const open = () => openNews(article.id)
    return (
        <div
            ref={articleRef}
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
            className={cn(
                'group bg-card/30 border border-hairline/5 rounded-xl overflow-hidden cursor-pointer transition-colors hover:border-hairline/15 hover:bg-card/40',
                className,
            )}
        >
            <div className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <NavLink
                            view="news-detail"
                            params={{ newsId: article.id }}
                            onActivate={open}
                            className="min-w-0 text-base font-semibold text-foreground leading-snug truncate text-left"
                        >
                            {article.title}
                        </NavLink>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {isNew && <NewPill />}
                        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{formatAddedDate(article.publishedAt)}</span>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 leading-snug">{article.excerpt}</p>
                <div className="flex items-center justify-between gap-3 pt-0.5">
                    <div className="flex items-center gap-3 min-w-0">
                        <NavLink
                            view="news-detail"
                            params={{ newsId: article.id }}
                            onActivate={open}
                            className="inline-flex items-center gap-0.25 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors"
                        >
                            Read more
                            <ChevronsRight className="size-3 translate-y-0.5 transition-transform group-hover:translate-x-0.5" />
                        </NavLink>
                        {article.linkUrl && (
                            <a
                                href={article.linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors truncate"
                            >
                                <span className="truncate">{article.linkText?.trim() || 'Open link'}</span>
                                <ExternalLink className="size-3 shrink-0" />
                            </a>
                        )}
                    </div>
                    <CategoryChip category={category} />
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
    const itemRefs = useRef<Array<HTMLDivElement | null>>([])
    const [visibleHeight, setVisibleHeight] = useState<number | null>(null)

    useLayoutEffect(() => {
        if (articles.length === 0) return

        const measure = () => {
            const visibleCount = Math.min(2, articles.length)
            const first = itemRefs.current[0]
            const last = itemRefs.current[visibleCount - 1]
            if (!first || !last) return

            const height = last.offsetTop + last.offsetHeight - first.offsetTop
            setVisibleHeight(Math.ceil(height) + 2)
        }

        measure()

        const observer = new ResizeObserver(measure)
        itemRefs.current.slice(0, 2).forEach(node => {
            if (node) observer.observe(node)
        })
        window.addEventListener('resize', measure)

        return () => {
            observer.disconnect()
            window.removeEventListener('resize', measure)
        }
    }, [articles])

    if (articles.length === 0) return null
    return (
        <div className={cn('space-y-3', className)} style={visibleHeight ? { maxHeight: visibleHeight } : undefined}>
            {articles.map((a, index) => (
                <ArticleCard
                    key={a.id}
                    articleRef={node => { itemRefs.current[index] = node }}
                    article={a}
                    category={categories?.get(a.category) ?? null}
                    isNew={!!newSince && a.publishedAt > newSince}
                />
            ))}
        </div>
    )
}
