import { describe, expect, it } from 'vitest'
import { pickCamWindow, type TopLevelWindow } from './cam-window-match'

function win(overrides: Partial<TopLevelWindow<string>> & { handle: string }): TopLevelWindow<string> {
    return {
        pid: 100,
        visible: true,
        owned: false,
        title: 'Unreal Tournament',
        className: 'UnrealWWindowsViewportWindow',
        ...overrides,
    }
}

describe('pickCamWindow', () => {
    it('picks the game window of the cam process', () => {
        const windows = [win({ handle: 'other', pid: 200 }), win({ handle: 'cam' })]
        expect(pickCamWindow(windows, 100, 'UTBT Cam A1')?.handle).toBe('cam')
    })

    it('returns null when the process has no window yet', () => {
        expect(pickCamWindow([win({ handle: 'other', pid: 200 })], 100, 'UTBT Cam A1')).toBeNull()
    })

    it('skips hidden and owned windows', () => {
        const windows = [
            win({ handle: 'hidden', visible: false }),
            win({ handle: 'dialog', owned: true }),
        ]
        expect(pickCamWindow(windows, 100, 'UTBT Cam A1')).toBeNull()
    })

    it('prefers a window that already carries the cam title', () => {
        const windows = [
            win({ handle: 'splash', className: 'Splash', title: '' }),
            win({ handle: 'titled', title: 'UTBT Cam A1', className: 'Other' }),
        ]
        expect(pickCamWindow(windows, 100, 'UTBT Cam A1')?.handle).toBe('titled')
    })

    it('prefers the viewport window over a splash screen', () => {
        const windows = [
            win({ handle: 'splash', className: 'Splash', title: '' }),
            win({ handle: 'viewport', title: 'Unreal Tournament' }),
        ]
        expect(pickCamWindow(windows, 100, 'UTBT Cam B2')?.handle).toBe('viewport')
    })

    it('falls back to a window titled Unreal Tournament', () => {
        const windows = [
            win({ handle: 'splash', className: 'Splash', title: '' }),
            win({ handle: 'game', className: 'SomethingElse', title: 'Unreal Tournament' }),
        ]
        expect(pickCamWindow(windows, 100, 'UTBT Cam B2')?.handle).toBe('game')
    })

    it('takes the only visible window of the process when nothing else matches', () => {
        const windows = [win({ handle: 'only', className: 'Unknown', title: 'Untitled' })]
        expect(pickCamWindow(windows, 100, 'UTBT Cam B1')?.handle).toBe('only')
    })
})
