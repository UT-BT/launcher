export type NewsTag = 'announcement' | 'event' | 'mappack' | 'update'

export interface NewsArticle {
    id: string
    title: string
    excerpt: string
    coverImageUrl?: string
    tag: NewsTag
    publishedAt: string
    url?: string
    pinned?: boolean
    install?: boolean
}
