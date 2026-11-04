import { afterEach, describe, expect, it, vi } from 'vitest'
import { DESKTOP_CAPABILITIES, WEB_CAPABILITIES } from '@/app/platform/capabilities'
import { pushUrlForEntry, registerOverlay, replaceUrlForEntry } from './useUrlSync'

describe('overlay history gate', () => {
    afterEach(() => { vi.unstubAllGlobals() })

    it('is on for the web target and off for the desktop target', () => {
        expect(WEB_CAPABILITIES.overlayHistory).toBe(true)
        expect(DESKTOP_CAPABILITIES.overlayHistory).toBe(false)
    })

    it('on the desktop target, opening an overlay, navigating or replacing params writes no history entry', () => {
        const history = { pushState: vi.fn(), replaceState: vi.fn(), go: vi.fn(), state: null }
        vi.stubGlobal('window', { history })

        expect(registerOverlay(() => {})).toBeUndefined()
        pushUrlForEntry({ id: 1, view: 'maps', params: {}, state: {} })
        replaceUrlForEntry({ id: 1, view: 'run-compare', params: { compare: 'runs=0a0a0a0a-0000-4000-8000-00000000000a' }, state: {} })

        expect(history.pushState).not.toHaveBeenCalled()
        expect(history.replaceState).not.toHaveBeenCalled()
        expect(history.go).not.toHaveBeenCalled()
    })
})
