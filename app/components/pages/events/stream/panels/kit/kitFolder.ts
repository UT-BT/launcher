export const DEFAULT_KIT_FOLDER = 'C:\\UTBT-StreamKit'
export const KIT_FOLDER_STORAGE_KEY = 'utbt:streamKitFolder:v1'
const MAX_KIT_FOLDER_LENGTH = 180

const DRIVE_PREFIX = /^[A-Za-z]:[\\/]/
const INVALID_CHARACTERS = /[<>:"|?*]/

export function normalizeKitFolder(raw: string): string {
    return raw.trim().replace(/\//g, '\\').replace(/\\+$/, '')
}

export function kitFolderError(raw: string): string | null {
    const folder = raw.trim()
    if (!folder) return 'Enter the folder you keep the kit in.'
    if (!DRIVE_PREFIX.test(folder)) return 'Use a full Windows path that starts with a drive, like C:\\UTBT-StreamKit.'
    const normalized = normalizeKitFolder(folder)
    const rest = normalized.slice(3)
    if (!rest) return 'Pick a folder, not a whole drive.'
    if (normalized.length > MAX_KIT_FOLDER_LENGTH) return `Keep the path under ${MAX_KIT_FOLDER_LENGTH} characters.`
    if (INVALID_CHARACTERS.test(rest) || [...rest].some(char => char.charCodeAt(0) < 32)) return "The path can't contain < > : \" | ? * characters."
    const segments = rest.split('\\')
    if (segments.some(segment => !segment)) return "The path can't have an empty folder name."
    if (segments.some(segment => segment === '.' || segment === '..')) return "The path can't contain . or .. folders."
    return null
}

type FolderStore = Pick<Storage, 'getItem' | 'setItem'>

function readFolders(store: FolderStore): Record<string, string> {
    try {
        const parsed: unknown = JSON.parse(store.getItem(KIT_FOLDER_STORAGE_KEY) ?? '{}')
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string')) as Record<string, string>
    } catch {
        return {}
    }
}

export function loadKitFolder(store: FolderStore | null, userId: string): string {
    if (!store) return DEFAULT_KIT_FOLDER
    const saved = readFolders(store)[userId]
    return saved && kitFolderError(saved) === null ? saved : DEFAULT_KIT_FOLDER
}

export function saveKitFolder(store: FolderStore | null, userId: string, folder: string): void {
    if (!store) return
    try {
        store.setItem(KIT_FOLDER_STORAGE_KEY, JSON.stringify({ ...readFolders(store), [userId]: normalizeKitFolder(folder) }))
    } catch {
        return
    }
}

export function browserStore(): FolderStore | null {
    return typeof window === 'undefined' ? null : window.localStorage
}
