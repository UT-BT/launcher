import { STREAM_SCENES, streamScenePath, streamSceneUrl } from '@/app/components/stream/streamScenes'

export interface SceneLink {
    id: string
    label: string
    transparent: boolean
    url: string
    previewSrc: string
}

export function sceneLinks(eventSlug: string, streamerId: string, isWeb: boolean): SceneLink[] {
    return STREAM_SCENES.map(scene => {
        const url = streamSceneUrl(eventSlug, streamerId, scene.id)
        const base = isWeb ? streamScenePath(eventSlug, streamerId, scene.id) : url
        return { id: scene.id, label: scene.label, transparent: scene.transparent, url, previewSrc: `${base}?preview=1` }
    })
}
