const SITE_ORIGIN = (import.meta.env.VITE_SITE_ORIGIN || 'https://utbt.net').replace(/\/$/, '')

export const STREAM_SCENES = [
    { id: 'starting-soon', label: 'Starting Soon', transparent: false },
    { id: 'preview', label: 'Match Preview', transparent: false },
    { id: 'pick-ban', label: 'Pick & Ban', transparent: false },
    { id: 'betting', label: 'Betting', transparent: false },
    { id: 'overlay', label: 'Match Overlay', transparent: true },
    { id: 'intermission', label: 'Intermission', transparent: false },
    { id: 'post-match', label: 'Post-match', transparent: false },
    { id: 'standings', label: 'Standings', transparent: false },
    { id: 'brb', label: 'BRB', transparent: false },
    { id: 'ending', label: 'Ending', transparent: false },
    { id: 'caster', label: 'Caster Cam', transparent: true },
] as const

export type StreamSceneId = (typeof STREAM_SCENES)[number]['id']

export interface StreamSceneRoute {
    eventSlug: string
    streamerId: string
    scene: string
}

const SCENE_IDS: ReadonlySet<string> = new Set(STREAM_SCENES.map(scene => scene.id))
const TRANSPARENT_SCENE_IDS: ReadonlySet<string> = new Set(
    STREAM_SCENES.filter(scene => scene.transparent).map(scene => scene.id)
)

export function isStreamSceneId(value: string): value is StreamSceneId {
    return SCENE_IDS.has(value)
}

export function isTransparentStreamScene(scene: string): boolean {
    return TRANSPARENT_SCENE_IDS.has(scene)
}

function decodeSegment(segment: string): string {
    try {
        return decodeURIComponent(segment)
    } catch {
        return segment
    }
}

export function parseStreamScenePath(pathname: string): StreamSceneRoute | null {
    const segments = pathname.replace(/\/$/, '').split('/')
    if (segments.length !== 5 || segments[0] !== '' || segments[1] !== 'stream') return null
    const [eventSlug, streamerId, scene] = segments.slice(2)
    if (!eventSlug || !streamerId || !scene) return null
    return { eventSlug: decodeSegment(eventSlug), streamerId: decodeSegment(streamerId), scene: decodeSegment(scene) }
}

export function streamScenePath(eventSlug: string, streamerId: string, scene: StreamSceneId): string {
    return `/stream/${encodeURIComponent(eventSlug)}/${encodeURIComponent(streamerId)}/${scene}`
}

export function streamSceneUrl(eventSlug: string, streamerId: string, scene: StreamSceneId): string {
    return SITE_ORIGIN + streamScenePath(eventSlug, streamerId, scene)
}
