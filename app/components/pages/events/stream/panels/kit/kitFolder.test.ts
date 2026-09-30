import { describe, expect, it } from 'vitest'
import { DEFAULT_KIT_FOLDER, KIT_FOLDER_STORAGE_KEY, kitFolderError, loadKitFolder, normalizeKitFolder, saveKitFolder } from './kitFolder'

function memoryStore(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial))
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
    }
}

describe('kitFolderError', () => {
    it.each(['C:\\UTBT-StreamKit', 'D:\\Streaming\\UTBT Kit', 'c:/kit', 'C:\\kit\\', 'E:\\a\\b\\c'])('accepts %s', folder => {
        expect(kitFolderError(folder)).toBeNull()
    })

    it.each([
        '',
        '   ',
        'kit',
        'C:kit',
        'C:',
        'C:\\',
        '\\\\server\\share\\kit',
        '\\\\?\\C:\\kit',
        '/home/me/kit',
        '~\\kit',
        'C:\\kit\\..\\other',
        'C:\\kit\\.\\x',
        'C:\\a\\\\b',
        'C:\\kit?',
        'C:\\ki"t',
        `C:\\${'a'.repeat(200)}`,
    ])('rejects %j', folder => {
        expect(kitFolderError(folder)).not.toBeNull()
    })
})

describe('normalizeKitFolder', () => {
    it('trims, uses backslashes and drops trailing separators', () => {
        expect(normalizeKitFolder('  C:/UTBT/Kit//  ')).toBe('C:\\UTBT\\Kit')
    })
})

describe('kit folder storage', () => {
    it('defaults when nothing is saved or there is no storage', () => {
        expect(loadKitFolder(memoryStore(), '1')).toBe(DEFAULT_KIT_FOLDER)
        expect(loadKitFolder(null, '1')).toBe(DEFAULT_KIT_FOLDER)
    })

    it('remembers a folder per user', () => {
        const store = memoryStore()
        saveKitFolder(store, '1', 'D:/Kit')
        saveKitFolder(store, '2', 'E:\\Other')
        expect(loadKitFolder(store, '1')).toBe('D:\\Kit')
        expect(loadKitFolder(store, '2')).toBe('E:\\Other')
        expect(loadKitFolder(store, '3')).toBe(DEFAULT_KIT_FOLDER)
    })

    it('ignores corrupt or invalid saved values', () => {
        expect(loadKitFolder(memoryStore({ [KIT_FOLDER_STORAGE_KEY]: '{oops' }), '1')).toBe(DEFAULT_KIT_FOLDER)
        expect(loadKitFolder(memoryStore({ [KIT_FOLDER_STORAGE_KEY]: '[1]' }), '1')).toBe(DEFAULT_KIT_FOLDER)
        expect(loadKitFolder(memoryStore({ [KIT_FOLDER_STORAGE_KEY]: JSON.stringify({ 1: 'relative' }) }), '1')).toBe(DEFAULT_KIT_FOLDER)
    })
})
