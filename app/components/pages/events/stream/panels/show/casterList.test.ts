import { describe, expect, it } from 'vitest'
import {
    CASTERS_MAX,
    CASTER_NAME_MAX,
    addNamedCaster,
    addUserCaster,
    canAddCaster,
    casterPayload,
    castersFromDesk,
    moveCaster,
    pickableVolunteers,
    removeCaster,
    type CasterEntry,
} from './casterList'

const ANNA: CasterEntry = { userId: '111111111111', name: 'Anna' }
const GUEST: CasterEntry = { userId: null, name: 'Guest' }
const BEN: CasterEntry = { userId: '222222222222', name: 'Ben' }

function fullList(): CasterEntry[] {
    return Array.from({ length: CASTERS_MAX }, (_, index) => ({ userId: null, name: `Guest ${index}` }))
}

describe('castersFromDesk', () => {
    it('keeps users and free text apart, in order', () => {
        expect(castersFromDesk([
            { id: '111111111111', display_name: 'Anna', avatar: 'a.png' },
            { id: null, display_name: 'Guest', avatar: null },
            { id: '222222222222', display_name: null, avatar: 'b.png' },
        ])).toEqual([ANNA, GUEST, { userId: '222222222222', name: '' }])
    })
})

describe('addUserCaster', () => {
    it('appends a volunteer', () => {
        expect(addUserCaster([GUEST], ANNA.userId!, 'Anna')).toEqual([GUEST, ANNA])
    })

    it('ignores a volunteer who is already listed', () => {
        const entries = [ANNA]
        expect(addUserCaster(entries, ANNA.userId!, 'Anna')).toBe(entries)
    })

    it('stops at the cap', () => {
        const full = fullList()
        expect(canAddCaster(full)).toBe(false)
        expect(addUserCaster(full, ANNA.userId!, 'Anna')).toBe(full)
    })
})

describe('addNamedCaster', () => {
    it('trims the name and appends it', () => {
        expect(addNamedCaster([ANNA], '  Guest ')).toEqual([ANNA, GUEST])
    })

    it('ignores blank names and case-insensitive repeats', () => {
        const entries = [GUEST]
        expect(addNamedCaster(entries, '   ')).toBe(entries)
        expect(addNamedCaster(entries, 'guest')).toBe(entries)
    })

    it('cuts a name to the length cap', () => {
        const [entry] = addNamedCaster([], 'x'.repeat(CASTER_NAME_MAX + 10))
        expect(entry.name).toHaveLength(CASTER_NAME_MAX)
    })

    it('stops at the cap', () => {
        const full = fullList()
        expect(addNamedCaster(full, 'Extra')).toBe(full)
    })
})

describe('removeCaster and moveCaster', () => {
    it('removes one entry and leaves the rest in order', () => {
        expect(removeCaster([ANNA, GUEST, BEN], 1)).toEqual([ANNA, BEN])
    })

    it('ignores an index that is not there', () => {
        const entries = [ANNA]
        expect(removeCaster(entries, 3)).toBe(entries)
    })

    it('moves an entry up and down', () => {
        expect(moveCaster([ANNA, GUEST, BEN], 2, -1)).toEqual([ANNA, BEN, GUEST])
        expect(moveCaster([ANNA, GUEST, BEN], 0, 1)).toEqual([GUEST, ANNA, BEN])
    })

    it('does not move past either end', () => {
        const entries = [ANNA, GUEST]
        expect(moveCaster(entries, 0, -1)).toBe(entries)
        expect(moveCaster(entries, 1, 1)).toBe(entries)
    })
})

describe('casterPayload', () => {
    it('sends a user id for volunteers and a name for free text', () => {
        expect(casterPayload([ANNA, GUEST])).toEqual([{ user: '111111111111' }, { name: 'Guest' }])
    })
})

describe('pickableVolunteers', () => {
    it('hides volunteers who are already casters', () => {
        const volunteers = [{ id: ANNA.userId! }, { id: BEN.userId! }]
        expect(pickableVolunteers(volunteers, [ANNA, GUEST])).toEqual([{ id: BEN.userId! }])
    })
})
