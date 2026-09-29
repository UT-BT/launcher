export type KitFolderResult =
    | { ok: true; folder: string }
    | { ok: false; reason: 'empty' | 'not-absolute' | 'traversal' | 'invalid-characters' | 'drive-root' }

const DRIVE_PATH = /^([A-Za-z]):[\\/](.*)$/
const INVALID_SEGMENT_CHARACTERS = /[<>:"|?*]/

function hasInvalidCharacters(segment: string): boolean {
    return INVALID_SEGMENT_CHARACTERS.test(segment) || [...segment].some(character => character.charCodeAt(0) < 0x20)
}

export function validateKitFolder(value: string): KitFolderResult {
    const trimmed = value.trim()
    if (trimmed === '') return { ok: false, reason: 'empty' }
    const match = DRIVE_PATH.exec(trimmed)
    if (!match) return { ok: false, reason: 'not-absolute' }
    const [, drive, rest] = match
    const segments = rest.split(/[\\/]+/).filter(segment => segment !== '')
    if (segments.some(segment => segment === '.' || segment === '..')) return { ok: false, reason: 'traversal' }
    if (segments.some(hasInvalidCharacters)) return { ok: false, reason: 'invalid-characters' }
    if (segments.length === 0) return { ok: false, reason: 'drive-root' }
    return { ok: true, folder: [`${drive.toUpperCase()}:`, ...segments].join('\\') }
}
