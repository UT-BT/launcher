import { streamSoundOf, type StreamSound } from '@/app/components/pages/events/pickban/stream/streamSound'
import { isStreamMotionOff } from '@/app/components/pages/events/pickban/pickBanMotionPreference'

export interface StreamSceneOptions {
    sound: StreamSound
    animate: boolean
    preview: boolean
}

export function isStreamPreview(search: string): boolean {
    return new URLSearchParams(search).get('preview') === '1'
}

export function streamSceneOptionsOf(search: string): StreamSceneOptions {
    return {
        sound: streamSoundOf(search),
        animate: !isStreamMotionOff(search),
        preview: isStreamPreview(search),
    }
}

export interface StreamSceneProps {
    eventSlug: string
    streamerId: string
    options: StreamSceneOptions
}
