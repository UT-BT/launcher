export const STREAM_SCENES = [
    { id: 'starting-soon', label: 'Starting Soon', transparent: false },
    { id: 'preview', label: 'Match Preview', transparent: false },
    { id: 'pick-ban', label: 'Pick & Ban', transparent: false },
    { id: 'betting', label: 'Betting', transparent: false },
    { id: 'overlay', label: 'Match Overlay', obsName: 'Match', transparent: true },
    { id: 'intermission', label: 'Intermission', transparent: false },
    { id: 'next-map', label: 'Next Map', transparent: false },
    { id: 'post-match', label: 'Post-match', transparent: false },
    { id: 'standings', label: 'Standings', transparent: false },
    { id: 'predictor-standings', label: 'Predictor Standings', transparent: false },
    { id: 'brb', label: 'BRB', transparent: false },
    { id: 'ending', label: 'Ending', transparent: false },
    { id: 'caster', label: 'Caster Cam', transparent: true },
] as const

export type StreamScene = (typeof STREAM_SCENES)[number]

export type StreamSceneId = StreamScene['id']

export const NEWEST_STREAM_SCENE_ID: StreamSceneId = 'predictor-standings'

export function streamSceneLabel(id: StreamSceneId): string {
    return STREAM_SCENES.find(scene => scene.id === id)!.label
}

export function streamSceneObsName(scene: StreamScene): string {
    return 'obsName' in scene ? scene.obsName : scene.label
}
