import { describe, expect, it } from 'vitest'
import { shortcutFor, SHORTCUT_SHEET, type ShortcutKey } from './shortcuts'

function press(key: string, modifiers: Partial<Omit<ShortcutKey, 'key'>> = {}) {
    return shortcutFor({ key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, ...modifiers })
}

describe('the page shortcuts', () => {
    it('maps every key of the shortcut list to its action', () => {
        expect(press(' ')).toEqual({ kind: 'play-pause' })
        expect(press('ArrowLeft')).toEqual({ kind: 'frame', direction: -1 })
        expect(press('ArrowRight')).toEqual({ kind: 'frame', direction: 1 })
        expect(press('j')).toEqual({ kind: 'skip', direction: -1 })
        expect(press('l')).toEqual({ kind: 'skip', direction: 1 })
        expect(['1', '2', '3', '4', '5', '6', '7', '8'].map(key => press(key))).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map(tile => ({ kind: 'focus', tile })))
        expect(press('0')).toEqual({ kind: 'grid' })
        expect(press('[')).toEqual({ kind: 'cue', direction: -1 })
        expect(press(']')).toEqual({ kind: 'cue', direction: 1 })
        expect(press('f')).toEqual({ kind: 'fullscreen' })
        expect(press('r')).toEqual({ kind: 'reference' })
        expect(press('m')).toEqual({ kind: 'audio' })
        expect(press('?', { shiftKey: true })).toEqual({ kind: 'sheet' })
    })

    it('reads letters the same with Caps Lock on', () => {
        expect(['J', 'L', 'F', 'R', 'M'].map(key => press(key)?.kind)).toEqual(['skip', 'skip', 'fullscreen', 'reference', 'audio'])
    })

    it('leaves Alt, Ctrl and Meta combinations to the app, so Alt+arrow history keeps working', () => {
        for (const modifier of ['altKey', 'ctrlKey', 'metaKey'] as const) {
            expect(press('ArrowLeft', { [modifier]: true })).toBeNull()
            expect(press('ArrowRight', { [modifier]: true })).toBeNull()
            expect(press('f', { [modifier]: true })).toBeNull()
        }
    })

    it('reads the cue keys typed with AltGr, which reports Ctrl and Alt too', () => {
        const altGraph = (key: string) => key === 'AltGraph'
        expect(press('[', { altKey: true, ctrlKey: true, getModifierState: altGraph })).toEqual({ kind: 'cue', direction: -1 })
        expect(press(']', { altKey: true, ctrlKey: true, getModifierState: altGraph })).toEqual({ kind: 'cue', direction: 1 })
        expect(press('[', { altKey: true, ctrlKey: true, getModifierState: () => false })).toBeNull()
    })

    it('leaves AltGr with an arrow to the app, like Ctrl+Alt', () => {
        const altGraph = (key: string) => key === 'AltGraph'
        expect(press('ArrowLeft', { altKey: true, ctrlKey: true, getModifierState: altGraph })).toBeNull()
        expect(press('ArrowRight', { altKey: true, ctrlKey: true, getModifierState: altGraph })).toBeNull()
    })

    it('reads the number row by position on layouts that type a symbol there, as AZERTY does', () => {
        expect(press('&', { code: 'Digit1' })).toEqual({ kind: 'focus', tile: 1 })
        expect(press('è', { code: 'Digit7' })).toEqual({ kind: 'focus', tile: 7 })
        expect(press('à', { code: 'Digit0' })).toEqual({ kind: 'grid' })
        expect(press('ç', { code: 'Digit9' })).toBeNull()
        expect(press('[', { code: 'Digit2' })).toEqual({ kind: 'cue', direction: -1 })
        expect(press('1', { code: 'Digit1', shiftKey: true })).toBeNull()
    })

    it('reserves Shift with a number and leaves other Shift keys alone', () => {
        expect(press('!', { shiftKey: true })).toBeNull()
        expect(press('1', { shiftKey: true })).toBeNull()
        expect(press('F', { shiftKey: true })).toBeNull()
        expect(press('ArrowRight', { shiftKey: true })).toBeNull()
    })

    it('repeats only the frame and skip keys while held', () => {
        expect(press('ArrowRight', { repeat: true })).toEqual({ kind: 'frame', direction: 1 })
        expect(press('l', { repeat: true })).toEqual({ kind: 'skip', direction: 1 })
        for (const key of [' ', '1', '0', '[', 'f', 'r', 'm', '?']) expect(press(key, { repeat: true })).toBeNull()
    })

    it('ignores keys it has no action for', () => {
        expect(press('9')).toBeNull()
        expect(press('k')).toBeNull()
        expect(press('Enter')).toBeNull()
        expect(press('Escape')).toBeNull()
    })

    it('lists every shortcut with the visible control that does the same', () => {
        expect(SHORTCUT_SHEET.map(entry => entry.keys.join(' '))).toEqual(['Space', '← →', 'J L', '1–8', '0', '[ ]', 'F', 'R', 'M', '?'])
        for (const entry of SHORTCUT_SHEET) expect(entry.control).not.toBe('')
    })
})
