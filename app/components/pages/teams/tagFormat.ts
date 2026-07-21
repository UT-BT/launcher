import type { TeamTagPosition } from '@/app/utils/api'

export const TAG_MIN_LENGTH = 2
export const TAG_MAX_LENGTH = 9
export const TAG_DECORATION = '-=_.(){}[]<>~*!#'

const TAG_MIN_ALPHANUMERICS = 2
const TAG_ALLOWED_PATTERN = /^[A-Za-z0-9\-=_.(){}[\]<>~*!#]+$/
const TAG_COLOR_CODE_PATTERN = /<[Cc]..>/

export function tagValidationError(tag: string): string | null {
    if (tag.length < TAG_MIN_LENGTH || tag.length > TAG_MAX_LENGTH) {
        return `Clan tag must be ${TAG_MIN_LENGTH}-${TAG_MAX_LENGTH} characters.`
    }
    if (!TAG_ALLOWED_PATTERN.test(tag)) {
        return `Clan tag can only use letters, digits and ${TAG_DECORATION.split('').join(' ')}`
    }
    if ((tag.match(/[A-Za-z0-9]/g) ?? []).length < TAG_MIN_ALPHANUMERICS) {
        return `Clan tag needs at least ${TAG_MIN_ALPHANUMERICS} letters or digits.`
    }
    if (TAG_COLOR_CODE_PATTERN.test(tag)) {
        return 'Clan tag cannot use a <Cxx> in-game colour-code pattern.'
    }
    return null
}

export const TEAM_NAME_MIN_LENGTH = 3
export const TEAM_NAME_MAX_LENGTH = 24

const TEAM_NAME_ALLOWED_PATTERN = /^[A-Za-z0-9 .\-_'!]+$/

export function nameValidationError(name: string): string | null {
    const collapsed = name.split(/\s+/).filter(Boolean).join(' ')
    if (collapsed.length < TEAM_NAME_MIN_LENGTH || collapsed.length > TEAM_NAME_MAX_LENGTH) {
        return `Team name must be ${TEAM_NAME_MIN_LENGTH}-${TEAM_NAME_MAX_LENGTH} characters.`
    }
    if (!TEAM_NAME_ALLOWED_PATTERN.test(collapsed)) {
        return "Team name can only use letters, digits, spaces and . - _ ' !"
    }
    if (!/[A-Za-z0-9]/.test(collapsed)) {
        return 'Team name needs at least one letter or digit.'
    }
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
