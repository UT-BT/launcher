import { describe, expect, it } from 'vitest'
import type { EventStreamer } from '@/app/utils/api'
import { operatingAsChoices, operatingAsId, streamTabVisible, type OperatingViewer } from './streamTabAccess'

const ALICE: EventStreamer = { id: '111111111', display_name: 'Alice', twitch_url: 'https://twitch.tv/alice' }
const BOB: EventStreamer = { id: '222222222', display_name: 'Bob', twitch_url: null }

const STREAMER: OperatingViewer = { id: ALICE.id, name: 'Alice', isStreamer: true, isManager: false }
const MANAGER: OperatingViewer = { id: '999999999', name: 'Mona', isStreamer: false, isManager: true }
const STREAMING_MANAGER: OperatingViewer = { ...MANAGER, isStreamer: true }

describe('streamTabVisible', () => {
    it('shows the tab to a signed-in streaming volunteer', () => {
        expect(streamTabVisible({ signedIn: true, isStreamer: true, canManageBracket: false })).toBe(true)
    })

    it('shows the tab to a signed-in bracket manager', () => {
        expect(streamTabVisible({ signedIn: true, isStreamer: false, canManageBracket: true })).toBe(true)
    })

    it('hides the tab from a regular player', () => {
        expect(streamTabVisible({ signedIn: true, isStreamer: false, canManageBracket: false })).toBe(false)
    })

    it('hides the tab when signed out, whatever a stale status says', () => {
        expect(streamTabVisible({ signedIn: false, isStreamer: true, canManageBracket: true })).toBe(false)
    })
})

describe('operatingAsId', () => {
    it('keeps a streamer on themself even when another streamer was chosen', () => {
        expect(operatingAsId(STREAMER, [ALICE, BOB], BOB.id)).toBe(ALICE.id)
    })

    it('puts a manager on the streamer they chose', () => {
        expect(operatingAsId(MANAGER, [ALICE, BOB], BOB.id)).toBe(BOB.id)
    })

    it('leaves a manager who does not stream on nobody until they choose', () => {
        expect(operatingAsId(MANAGER, [ALICE, BOB], null)).toBeNull()
    })

    it('puts a manager who streams on themself by default', () => {
        expect(operatingAsId(STREAMING_MANAGER, [ALICE, BOB], null)).toBe(MANAGER.id)
    })

    it('drops a chosen streamer who is no longer listed', () => {
        expect(operatingAsId(STREAMING_MANAGER, [ALICE, BOB], '333333333')).toBe(MANAGER.id)
        expect(operatingAsId(MANAGER, [ALICE, BOB], '333333333')).toBeNull()
    })

    it('operates as nobody while the viewer has no known id', () => {
        expect(operatingAsId({ ...STREAMER, id: '' }, [ALICE, BOB], null)).toBeNull()
    })

    it('keeps a manager on their choice while the streamer list is still loading', () => {
        expect(operatingAsId(STREAMING_MANAGER, null, BOB.id)).toBe(BOB.id)
    })
})

describe('operatingAsChoices', () => {
    it('offers a streamer only themself', () => {
        expect(operatingAsChoices(STREAMER, [ALICE, BOB])).toEqual([{ id: ALICE.id, display_name: 'Alice', twitch_url: null }])
    })

    it('offers a manager the event streamers', () => {
        expect(operatingAsChoices(MANAGER, [ALICE, BOB])).toEqual([ALICE, BOB])
    })

    it('adds a streaming manager missing from the list ahead of it', () => {
        expect(operatingAsChoices(STREAMING_MANAGER, [ALICE, BOB])).toEqual([
            { id: MANAGER.id, display_name: 'Mona', twitch_url: null }, ALICE, BOB,
        ])
    })

    it('keeps a streaming manager who is already listed where the list puts them', () => {
        const listedManager: EventStreamer = { id: MANAGER.id, display_name: 'Mona', twitch_url: 'https://twitch.tv/mona' }
        expect(operatingAsChoices(STREAMING_MANAGER, [ALICE, listedManager])).toEqual([ALICE, listedManager])
    })

    it('offers a manager nothing but themself while the list loads', () => {
        expect(operatingAsChoices(MANAGER, null)).toEqual([])
        expect(operatingAsChoices(STREAMING_MANAGER, null)).toEqual([{ id: MANAGER.id, display_name: 'Mona', twitch_url: null }])
    })
})
