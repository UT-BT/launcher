import type { TeamTagPosition } from '@/app/utils/api'

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
