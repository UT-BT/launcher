import { describe, expect, it } from 'vitest'
import { validateKitFolder } from './kit-folder'

describe('validateKitFolder', () => {
    it('accepts a drive-letter path', () => {
        expect(validateKitFolder('C:\\UTBT-StreamKit')).toEqual({ ok: true, folder: 'C:\\UTBT-StreamKit' })
    })

    it('normalises forward slashes, doubled and trailing separators', () => {
        expect(validateKitFolder('D:/Streaming//UTBT Kit/')).toEqual({ ok: true, folder: 'D:\\Streaming\\UTBT Kit' })
    })

    it('trims surrounding spaces', () => {
        expect(validateKitFolder('  C:\\Kit  ')).toEqual({ ok: true, folder: 'C:\\Kit' })
    })

    it.each(['UTBT-StreamKit', '.\\kit', 'kit\\sub', 'C:kit', '\\kit', '/kit'])('refuses the relative path %s', value => {
        expect(validateKitFolder(value)).toEqual({ ok: false, reason: 'not-absolute' })
    })

    it.each(['\\\\server\\share\\kit', '//server/share/kit', '\\\\?\\C:\\kit'])('refuses the network or device path %s', value => {
        expect(validateKitFolder(value)).toEqual({ ok: false, reason: 'not-absolute' })
    })

    it.each(['C:\\kit\\..\\Windows', 'C:\\..\\kit', 'C:/kit/../../x', 'C:\\kit\\.\\sub'])('refuses the traversal path %s', value => {
        expect(validateKitFolder(value)).toEqual({ ok: false, reason: 'traversal' })
    })

    it.each(['C:\\kit?', 'C:\\ki*t', 'C:\\a:b', 'C:\\kit<1>', 'C:\\kit|x', 'C:\\ki"t', 'C:\\kit\u0001'])('refuses characters Windows does not allow in %s', value => {
        expect(validateKitFolder(value)).toEqual({ ok: false, reason: 'invalid-characters' })
    })

    it('refuses a bare drive root', () => {
        expect(validateKitFolder('C:\\')).toEqual({ ok: false, reason: 'drive-root' })
    })

    it('refuses an empty value', () => {
        expect(validateKitFolder('   ')).toEqual({ ok: false, reason: 'empty' })
    })
})
