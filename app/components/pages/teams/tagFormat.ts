import type { TeamTagPosition } from '@/app/utils/api'

export function tagValidationError(tag: string): string | null {
    if (tag.includes('|')) return 'Clan tag cannot contain the | character.'
    if (/<[Cc]..>/.test(tag)) return 'Clan tag cannot use a <Cxx> in-game colour-code pattern.'
    return null
}

export function formatTaggedAlias(
    alias: string | null | undefined,
    tag: string | null | undefined,
    position: TeamTagPosition | null | undefined,
): string {
    const name = (alias && alias.trim()) || 'Player'
    const trimmedTag = tag?.trim()
    if (!trimmedTag) return name
    return position === 'suffix' ? `${name} ${trimmedTag}` : `${trimmedTag} ${name}`
}
