import { describe, expect, it } from 'vitest'
import { ROSTER_EMPTY_TEXT, ROSTER_FAILED_TEXT, streamerListNote } from './streamerRoster'

describe('streamerListNote', () => {
    it('points staff at the roster when it is empty', () => {
        expect(streamerListNote(false, false)).toBe(ROSTER_EMPTY_TEXT)
        expect(ROSTER_EMPTY_TEXT).toBe('No streamers on the roster yet. Staff add them in Admin → Streamers.')
    })

    it('says the list is loading until it arrives', () => {
        expect(streamerListNote(false, true)).toBe('Loading streamers…')
    })

    it('says the roster could not be loaded, even while a retry is loading', () => {
        expect(streamerListNote(true, false)).toBe(ROSTER_FAILED_TEXT)
        expect(streamerListNote(true, true)).toBe(ROSTER_FAILED_TEXT)
    })
})
