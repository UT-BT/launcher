export const HOT_STATE_ACTIVE_MS = 2_000
export const HOT_STATE_HIDDEN_MS = 30_000
export const COMPOSITE_ACTIVE_MS = 30_000
export const COMPOSITE_HIDDEN_MS = 120_000

export interface SceneSource {
    inObs: boolean
    obsActive: boolean
    obsVisible: boolean
    preview: boolean
}

export interface SceneCadence {
    active: boolean
    hotStateMs: number
    compositeMs: number
}

export function isSceneActive({ inObs, obsActive, obsVisible, preview }: SceneSource): boolean {
    if (preview) return false
    if (!inObs) return true
    return obsActive || obsVisible
}

export function sceneCadence(source: SceneSource): SceneCadence {
    const active = isSceneActive(source)
    return {
        active,
        hotStateMs: active ? HOT_STATE_ACTIVE_MS : HOT_STATE_HIDDEN_MS,
        compositeMs: active ? COMPOSITE_ACTIVE_MS : COMPOSITE_HIDDEN_MS,
    }
}

export function refetchesOnChange(previous: SceneCadence, next: SceneCadence): boolean {
    return !previous.active && next.active
}

export interface SceneCadenceHost {
    obsstudio?: unknown
    addEventListener: (type: string, listener: (event: Event) => void) => void
    removeEventListener: (type: string, listener: (event: Event) => void) => void
}

export interface SceneCadenceStore {
    getCadence: () => SceneCadence
    subscribe: (listener: () => void) => () => void
    onActivate: (listener: () => void) => () => void
    start: () => void
    stop: () => void
}

const OBS_ACTIVE_EVENT = 'obsSourceActiveChanged'
const OBS_VISIBLE_EVENT = 'obsSourceVisibleChanged'

function detailFlag(event: Event, key: 'active' | 'visible'): boolean {
    const detail = (event as CustomEvent<unknown>).detail
    return typeof detail === 'object' && detail !== null && (detail as { [flag: string]: unknown })[key] === true
}

export function createSceneCadenceStore({ host, preview }: { host: SceneCadenceHost; preview: boolean }): SceneCadenceStore {
    let source: SceneSource = { inObs: host.obsstudio !== undefined, obsActive: false, obsVisible: false, preview }
    let cadence = sceneCadence(source)
    const listeners = new Set<() => void>()
    const activationListeners = new Set<() => void>()

    const update = (patch: Partial<SceneSource>) => {
        source = { ...source, ...patch }
        const next = sceneCadence(source)
        if (next.active === cadence.active) return
        const activated = refetchesOnChange(cadence, next)
        cadence = next
        for (const listener of listeners) listener()
        if (activated) for (const listener of activationListeners) listener()
    }

    const onActive = (event: Event) => update({ obsActive: detailFlag(event, 'active') })
    const onVisible = (event: Event) => update({ obsVisible: detailFlag(event, 'visible') })

    return {
        getCadence: () => cadence,
        subscribe(listener) {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
        onActivate(listener) {
            activationListeners.add(listener)
            return () => { activationListeners.delete(listener) }
        },
        start() {
            host.addEventListener(OBS_ACTIVE_EVENT, onActive)
            host.addEventListener(OBS_VISIBLE_EVENT, onVisible)
        },
        stop() {
            host.removeEventListener(OBS_ACTIVE_EVENT, onActive)
            host.removeEventListener(OBS_VISIBLE_EVENT, onVisible)
        },
    }
}
