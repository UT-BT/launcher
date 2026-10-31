export function mapAuthorName(map: { author?: string | number | null; author_str?: string | null } | null | undefined): string {
    if (!map) return ''
    if (typeof map.author === 'number') return String(map.author)
    const author = map.author?.trim()
    if (author) return author
    return map.author_str?.trim() ?? ''
}
