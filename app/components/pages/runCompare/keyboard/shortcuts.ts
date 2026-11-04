import { MAX_VIDEO_TILES } from '../model/raceModel'
import { MAX_TEAM_RUNS } from '../model/teamModel'
import { SKIP_SECONDS } from '../playback/playbackConstants'

export type Shortcut =
    | { kind: 'play-pause' }
    | { kind: 'frame'; direction: 1 | -1 }
    | { kind: 'skip'; direction: 1 | -1 }
    | { kind: 'focus'; tile: number }
    | { kind: 'focus-row'; row: number }
    | { kind: 'grid' }
    | { kind: 'cue'; direction: 1 | -1 }
    | { kind: 'fullscreen' }
    | { kind: 'reference' }
    | { kind: 'audio' }
    | { kind: 'sheet' }

export interface ShortcutKey {
    key: string
    code?: string
    altKey: boolean
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    repeat: boolean
    getModifierState?: (key: string) => boolean
}

export interface ShortcutEntry {
    keys: string[]
    action: string
    control: string
}

export const SHORTCUT_SHEET: readonly ShortcutEntry[] = [
    { keys: ['Space'], action: 'Play or pause', control: 'Play' },
    { keys: ['←', '→'], action: 'One frame back or forward', control: 'Previous frame, Next frame' },
    { keys: ['J', 'L'], action: `${SKIP_SECONDS} seconds back or forward`, control: `Back ${SKIP_SECONDS} seconds, Forward ${SKIP_SECONDS} seconds` },
    { keys: [`1–${MAX_VIDEO_TILES}`], action: 'Focus that tile', control: 'Click a tile' },
    { keys: [`Shift+1–${MAX_TEAM_RUNS}`], action: 'Focus that team row', control: 'Click the team’s row header' },
    { keys: ['0'], action: 'Back to the grid', control: 'Click the focused tile' },
    { keys: ['[', ']'], action: 'Previous or next cue', control: 'Previous cue, Next cue' },
    { keys: ['F'], action: 'Stage fullscreen', control: 'Fullscreen' },
    { keys: ['R'], action: 'Make the focused tile its side’s reference', control: 'Pin on the tile' },
    { keys: ['M'], action: 'Move the audio to the next tile', control: 'Audio on the tile' },
    { keys: ['?'], action: 'This list', control: 'Shortcuts' },
]

const REPEATABLE = new Set<Shortcut['kind']>(['frame', 'skip'])

function plainShortcut(key: string): Shortcut | null {
    switch (key) {
        case ' ': return { kind: 'play-pause' }
        case 'ArrowLeft': return { kind: 'frame', direction: -1 }
        case 'ArrowRight': return { kind: 'frame', direction: 1 }
        case 'j': return { kind: 'skip', direction: -1 }
        case 'l': return { kind: 'skip', direction: 1 }
        case '[': return { kind: 'cue', direction: -1 }
        case ']': return { kind: 'cue', direction: 1 }
        case 'f': return { kind: 'fullscreen' }
        case 'r': return { kind: 'reference' }
        case 'm': return { kind: 'audio' }
    }
    return digitShortcut(key)
}

function digitShortcut(digit: string): Shortcut | null {
    const tile = Number(digit)
    if (!/^\d$/.test(digit)) return null
    if (tile === 0) return { kind: 'grid' }
    return tile <= MAX_VIDEO_TILES ? { kind: 'focus', tile } : null
}

function digitRowShortcut(code: string | undefined): Shortcut | null {
    const digit = code?.match(/^Digit(\d)$/)?.[1]
    return digit === undefined ? null : digitShortcut(digit)
}

function rowShortcut(event: ShortcutKey): Shortcut | null {
    const digit = event.code?.match(/^Digit(\d)$/)?.[1] ?? (/^\d$/.test(event.key) ? event.key : undefined)
    const row = Number(digit)
    return digit !== undefined && row >= 1 && row <= MAX_TEAM_RUNS ? { kind: 'focus-row', row } : null
}

function leftToTheApp(event: ShortcutKey): boolean {
    const altGraph = event.key.length === 1 && event.getModifierState?.('AltGraph') === true
    return event.metaKey || (!altGraph && (event.altKey || event.ctrlKey))
}

function keyShortcut(event: ShortcutKey): Shortcut | null {
    if (event.key === '?') return { kind: 'sheet' }
    if (event.shiftKey) return rowShortcut(event)
    return plainShortcut(event.key.length === 1 ? event.key.toLowerCase() : event.key) ?? digitRowShortcut(event.code)
}

export function shortcutFor(event: ShortcutKey): Shortcut | null {
    if (leftToTheApp(event)) return null
    const shortcut = keyShortcut(event)
    if (!shortcut || (event.repeat && !REPEATABLE.has(shortcut.kind))) return null
    return shortcut
}
