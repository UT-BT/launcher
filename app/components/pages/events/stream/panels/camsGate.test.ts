import { describe, expect, it } from 'vitest'
import { DESKTOP_CAPABILITIES, WEB_CAPABILITIES } from '@/app/platform/capabilities'
import { camsPanelView } from './camsGate'

describe('camsPanelView', () => {
    it('opens the cam tool in the desktop launcher', () => {
        expect(camsPanelView(DESKTOP_CAPABILITIES)).toBe('cam-tool')
    })

    it('shows the desktop launcher notice on the website', () => {
        expect(camsPanelView(WEB_CAPABILITIES)).toBe('web-notice')
    })
})
