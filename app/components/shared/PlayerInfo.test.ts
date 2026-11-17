import { describe, expect, it } from 'vitest'
import { isPlayerLinkable } from './PlayerInfo'

describe('isPlayerLinkable', () => {
    it('is true for a Discord player id, as a string or a number', () => {
        expect(isPlayerLinkable('260007417478250497')).toBe(true)
        expect(isPlayerLinkable(260007417478250)).toBe(true)
    })

    it('is false without a user id', () => {
        expect(isPlayerLinkable(undefined)).toBe(false)
        expect(isPlayerLinkable()).toBe(false)
    })

    it('is false for an id of 5 characters or fewer, such as a string-only author or a bot', () => {
        expect(isPlayerLinkable('12345')).toBe(false)
        expect(isPlayerLinkable(42)).toBe(false)
        expect(isPlayerLinkable('')).toBe(false)
    })

    it('is true from 6 characters on', () => {
        expect(isPlayerLinkable('123456')).toBe(true)
    })

    it('is false for a player id when the display is not interactive', () => {
        expect(isPlayerLinkable('260007417478250497', false)).toBe(false)
    })

    it('is interactive by default, as PlayerInfo is', () => {
        expect(isPlayerLinkable('260007417478250497')).toBe(isPlayerLinkable('260007417478250497', true))
    })
})
