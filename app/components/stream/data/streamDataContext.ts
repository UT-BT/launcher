import { createContext } from 'react'
import type { StreamSceneOptions } from '../streamSceneOptions'
import type { SceneCadenceStore } from './sceneCadence'
import type { SceneReadRegistry } from './sceneReadRegistry'
import type { StreamHotStateStore } from './streamHotStateStore'

export interface StreamData {
    eventSlug: string
    streamerId: string
    options: StreamSceneOptions
    cadence: SceneCadenceStore
    hotState: StreamHotStateStore
    reads: SceneReadRegistry
}

export const StreamDataContext = createContext<StreamData | null>(null)
