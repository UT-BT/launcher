import type { EventStreamer } from '@/app/utils/api'

export interface StreamTabViewer {
    signedIn: boolean
    isStreamer: boolean
    canManageBracket: boolean
}

export function streamTabVisible({ signedIn, isStreamer, canManageBracket }: StreamTabViewer): boolean {
    return signedIn && (isStreamer || canManageBracket)
}

export interface OperatingViewer {
    id: string
    name: string | null
    isStreamer: boolean
    isManager: boolean
}

export function operatingAsId(viewer: OperatingViewer, streamers: EventStreamer[] | null, chosenId: string | null): string | null {
    const chosenListed = streamers === null || streamers.some(streamer => streamer.id === chosenId)
    if (viewer.isManager && chosenId && chosenListed) return chosenId
    return viewer.isStreamer && viewer.id ? viewer.id : null
}

function selfAsStreamer(viewer: OperatingViewer): EventStreamer {
    return { id: viewer.id, display_name: viewer.name, twitch_url: null }
}

export function operatingAsChoices(viewer: OperatingViewer, streamers: EventStreamer[] | null): EventStreamer[] {
    if (!viewer.isManager) return [selfAsStreamer(viewer)]
    const listed = streamers ?? []
    if (!viewer.isStreamer || listed.some(streamer => streamer.id === viewer.id)) return listed
    return [selfAsStreamer(viewer), ...listed]
}
