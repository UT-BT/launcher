import { describe, expect, it } from 'vitest'
import {
    COMPOSITE_ACTIVE_MS,
    COMPOSITE_HIDDEN_MS,
    HOT_STATE_ACTIVE_MS,
    HOT_STATE_HIDDEN_MS,
    createSceneCadenceStore,
    refetchesOnChange,
    sceneCadence,
    type SceneCadenceHost,
    type SceneSource,
} from './sceneCadence'

const IN_OBS: SceneSource = { inObs: true, obsActive: false, obsVisible: false, preview: false }
const OUTSIDE_OBS: SceneSource = { inObs: false, obsActive: false, obsVisible: false, preview: false }

const ACTIVE = { active: true, hotStateMs: HOT_STATE_ACTIVE_MS, compositeMs: COMPOSITE_ACTIVE_MS }
const HIDDEN = { active: false, hotStateMs: HOT_STATE_HIDDEN_MS, compositeMs: COMPOSITE_HIDDEN_MS }

describe('sceneCadence', () => {
    it('polls the hot state every 2 s and composites every 30 s while the OBS source is on program', () => {
        expect(sceneCadence({ ...IN_OBS, obsActive: true })).toEqual(ACTIVE)
        expect(HOT_STATE_ACTIVE_MS).toBe(2_000)
        expect(COMPOSITE_ACTIVE_MS).toBe(30_000)
    })

    it('counts a source shown only in preview as active', () => {
        expect(sceneCadence({ ...IN_OBS, obsVisible: true })).toEqual(ACTIVE)
    })

    it('polls the hot state every 30 s and composites every 120 s while the OBS source is hidden', () => {
        expect(sceneCadence(IN_OBS)).toEqual(HIDDEN)
        expect(HOT_STATE_HIDDEN_MS).toBe(30_000)
        expect(COMPOSITE_HIDDEN_MS).toBe(120_000)
    })

    it('counts a page outside OBS as active', () => {
        expect(sceneCadence(OUTSIDE_OBS)).toEqual(ACTIVE)
    })

    it('forces the hidden cadence for preview=1, inside or outside OBS', () => {
        expect(sceneCadence({ ...OUTSIDE_OBS, preview: true })).toEqual(HIDDEN)
        expect(sceneCadence({ ...IN_OBS, obsActive: true, obsVisible: true, preview: true })).toEqual(HIDDEN)
    })
})

describe('refetchesOnChange', () => {
    it('refetches immediately when a hidden source becomes active', () => {
        expect(refetchesOnChange(HIDDEN, ACTIVE)).toBe(true)
    })

    it('does not refetch when the source stays active, stays hidden or goes hidden', () => {
        expect(refetchesOnChange(ACTIVE, ACTIVE)).toBe(false)
        expect(refetchesOnChange(HIDDEN, HIDDEN)).toBe(false)
        expect(refetchesOnChange(ACTIVE, HIDDEN)).toBe(false)
    })
})

function fakeHost(inObs: boolean) {
    const target = new EventTarget()
    const host: SceneCadenceHost = {
        obsstudio: inObs ? {} : undefined,
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
    }
    const fire = (type: string, detail: object) => target.dispatchEvent(new CustomEvent(type, { detail }))
    return { host, fire }
}

describe('createSceneCadenceStore', () => {
    it('starts hidden in OBS until the source says it is active, then refetches once', () => {
        const { host, fire } = fakeHost(true)
        const store = createSceneCadenceStore({ host, preview: false })
        store.start()
        let activations = 0
        let changes = 0
        store.onActivate(() => { activations += 1 })
        store.subscribe(() => { changes += 1 })

        expect(store.getCadence()).toEqual(HIDDEN)

        fire('obsSourceActiveChanged', { active: true })
        expect(store.getCadence()).toEqual(ACTIVE)
        expect(activations).toBe(1)

        fire('obsSourceVisibleChanged', { visible: true })
        expect(activations).toBe(1)

        fire('obsSourceActiveChanged', { active: false })
        expect(store.getCadence()).toEqual(ACTIVE)
        fire('obsSourceVisibleChanged', { visible: false })
        expect(store.getCadence()).toEqual(HIDDEN)
        expect(changes).toBe(2)

        store.stop()
        fire('obsSourceActiveChanged', { active: true })
        expect(store.getCadence()).toEqual(HIDDEN)
        expect(activations).toBe(1)
    })

    it('stays active outside OBS and ignores Page Visibility', () => {
        const { host, fire } = fakeHost(false)
        const store = createSceneCadenceStore({ host, preview: false })
        store.start()

        fire('visibilitychange', {})
        expect(store.getCadence()).toEqual(ACTIVE)
    })

    it('keeps preview pages on the hidden cadence even when OBS activates them', () => {
        const { host, fire } = fakeHost(true)
        const store = createSceneCadenceStore({ host, preview: true })
        store.start()
        let activations = 0
        store.onActivate(() => { activations += 1 })

        fire('obsSourceActiveChanged', { active: true })
        expect(store.getCadence()).toEqual(HIDDEN)
        expect(activations).toBe(0)
    })
})
