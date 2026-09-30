import { describe, expect, it } from 'vitest'
import { OTHER_URL_MAX_LENGTH, currentLinkText, normaliseTwitchInput, otherUrlProblem } from './channelView'

describe('normaliseTwitchInput', () => {
    it.each([
        ['someone', 'https://twitch.tv/someone'],
        ['  Some_One  ', 'https://twitch.tv/some_one'],
        ['twitch.tv/someone', 'https://twitch.tv/someone'],
        ['www.twitch.tv/someone/', 'https://twitch.tv/someone'],
        ['https://twitch.tv/someone', 'https://twitch.tv/someone'],
        ['http://www.twitch.tv/SomeOne', 'https://twitch.tv/someone'],
        ['https://m.twitch.tv/someone?sr=a', 'https://twitch.tv/someone'],
        ['abcd', 'https://twitch.tv/abcd'],
    ])('accepts %s', (input, url) => {
        expect(normaliseTwitchInput(input)).toEqual({ url })
    })

    it('keeps a 25-character login within 45 characters', () => {
        const result = normaliseTwitchInput('a'.repeat(25))
        expect(result).toEqual({ url: `https://twitch.tv/${'a'.repeat(25)}` })
        expect('url' in result && result.url?.length).toBeLessThanOrEqual(45)
    })

    it('treats blank input as clearing', () => {
        expect(normaliseTwitchInput('   ')).toEqual({ url: null })
    })

    it.each([
        'abc', 'a'.repeat(26), 'bad name', 'bad-name', 'twitch.tv/', 'twitch.tv/some/thing',
        'https://example.com/someone', 'https://twitch.tv.evil.com/someone', 'ftp://twitch.tv/someone', 'https://twitch.tv/',
    ])('rejects %s', input => {
        expect(normaliseTwitchInput(input)).toHaveProperty('problem')
    })
})

describe('otherUrlProblem', () => {
    it('accepts http and https links', () => {
        expect(otherUrlProblem(' https://example.com/live ')).toBeNull()
        expect(otherUrlProblem('http://example.com')).toBeNull()
    })

    it.each(['', '   ', 'example.com/live', 'ftp://example.com', 'javascript:alert(1)', 'https://a b.com'])('rejects %j', input => {
        expect(otherUrlProblem(input)).not.toBeNull()
    })

    it('caps the link at 500 characters', () => {
        const base = 'https://example.com/'
        expect(otherUrlProblem(base + 'a'.repeat(OTHER_URL_MAX_LENGTH - base.length))).toBeNull()
        expect(otherUrlProblem(base + 'a'.repeat(OTHER_URL_MAX_LENGTH - base.length + 1))).not.toBeNull()
    })
})

describe('currentLinkText', () => {
    it('shows the link or says none is set', () => {
        expect(currentLinkText('https://twitch.tv/utbt')).toBe('https://twitch.tv/utbt')
        expect(currentLinkText(null)).toBe('No stream link set')
        expect(currentLinkText('  ')).toBe('No stream link set')
    })
})
