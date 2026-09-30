import type { StreamHotState, StreamMatch } from './streamHotState'
import type { StreamHotStateSnapshot } from './streamHotStateStore'

export type SceneMatch =
    | { phase: 'loading'; state: null; match: null }
    | { phase: 'idle'; state: StreamHotState | null; match: null }
    | { phase: 'match'; state: StreamHotState; match: StreamMatch }

export function sceneMatchOf({ state, loading }: Pick<StreamHotStateSnapshot, 'state' | 'loading'>): SceneMatch {
    if (state === null) return loading ? { phase: 'loading', state: null, match: null } : { phase: 'idle', state: null, match: null }
    if (state.reason === 'none' || state.match === null) return { phase: 'idle', state, match: null }
    return { phase: 'match', state, match: state.match }
}
