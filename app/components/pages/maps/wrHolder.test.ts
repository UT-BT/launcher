import { describe, expect, it } from 'vitest'
import type { ActiveTitle, Record as WorldRecord, RecordTeamMember } from '@/app/utils/api'
import type { WRHolder, WRHolderMember } from '@/app/components/pages/MapsPage.types'
import { sortMembersBySplit, toWRHolder, wrHolderLines } from './wrHolder'

const rusher: ActiveTitle = { name: 'Rusher', rarity: 3, color_r: 10, color_g: 20, color_b: 30 }
const legend: ActiveTitle = { name: 'Legend', rarity: 5, color_r: 200, color_g: 100, color_b: 50 }

const soloRecord = (overrides: Partial<WorldRecord> = {}): WorldRecord => ({
    cap_id: 'cap-solo',
    user_id: '123456789012',
    map: 'BT-Solo',
    added: '2026-01-01T00:00:00Z',
    cap_time_seconds: 12.345,
    alias: 'Solo',
    color_r: 1,
    color_g: 2,
    color_b: 3,
    active_title: rusher,
    members: null,
    ...overrides,
})

const apiMember = (user: string, alias: string, split: number, title: ActiveTitle | null = null): RecordTeamMember => ({
    user,
    alias,
    cap_id: `cap-${alias}`,
    cap_time_seconds: split,
    verified: true,
    active_title: title,
})

const teamRecord = (members: RecordTeamMember[] | null | undefined): WorldRecord => ({
    cap_id: 'cap-team',
    user_id: null as unknown as string,
    map: 'BT-Team',
    added: '2026-01-01T00:00:00Z',
    cap_time_seconds: 30,
    alias: 'Alpha, Bravo, Charlie',
    active_title: null,
    members,
})

const member = (user_id: string, alias: string, split: number, title: ActiveTitle | null = null): WRHolderMember => ({
    user_id,
    alias,
    title,
    cap_time_seconds: split,
})

describe('toWRHolder', () => {
    it('keeps the id, alias, cap id, colours and title of a solo record, without members', () => {
        const holder = toWRHolder(soloRecord())

        expect(holder).toEqual({
            user_id: '123456789012',
            alias: 'Solo',
            cap_id: 'cap-solo',
            color_r: 1,
            color_g: 2,
            color_b: 3,
            title: rusher,
        })
        expect('members' in holder).toBe(false)
    })

    it('stores a missing solo title as null', () => {
        expect(toWRHolder(soloRecord({ active_title: undefined })).title).toBeNull()
        expect(toWRHolder(soloRecord({ active_title: null })).title).toBeNull()
    })

    it('maps team members in API order, user to user_id and active_title to title', () => {
        const holder = toWRHolder(teamRecord([
            apiMember('111111111111', 'Alpha', 21.5),
            apiMember('222222222222', 'Bravo', 19.25, legend),
            apiMember('333333333333', 'Charlie', 20),
        ]))

        expect(holder.members).toEqual([
            member('111111111111', 'Alpha', 21.5),
            member('222222222222', 'Bravo', 19.25, legend),
            member('333333333333', 'Charlie', 20),
        ])
        expect(holder.cap_id).toBe('cap-team')
    })

    it('turns the null user_id of a team record into an empty string', () => {
        expect(toWRHolder(teamRecord([apiMember('111111111111', 'Alpha', 10)])).user_id).toBe('')
    })

    it('sets no members when the API sends none, null or an empty array', () => {
        for (const members of [undefined, null, []]) {
            expect('members' in toWRHolder(teamRecord(members))).toBe(false)
        }
    })
})

describe('sortMembersBySplit', () => {
    it('sorts members by split, fastest first', () => {
        const sorted = sortMembersBySplit([
            member('a', 'A', 30),
            member('b', 'B', 10),
            member('c', 'C', 20),
        ])

        expect(sorted.map(m => m.alias)).toEqual(['B', 'C', 'A'])
    })

    it('keeps the API order of members with the same split', () => {
        const sorted = sortMembersBySplit([
            member('a', 'A', 20),
            member('b', 'B', 10),
            member('c', 'C', 20),
            member('d', 'D', 20),
        ])

        expect(sorted.map(m => m.alias)).toEqual(['B', 'A', 'C', 'D'])
    })

    it('leaves the input array unchanged', () => {
        const members = [member('a', 'A', 30), member('b', 'B', 10)]

        sortMembersBySplit(members)

        expect(members.map(m => m.alias)).toEqual(['A', 'B'])
    })
})

describe('wrHolderLines', () => {
    const soloHolder: WRHolder = { user_id: '123456789012', alias: 'Solo', cap_id: 'cap-solo', title: rusher }

    it('gives a solo holder one line with its id, alias and title, and no split', () => {
        expect(wrHolderLines(soloHolder, false)).toEqual([
            { userId: '123456789012', alias: 'Solo', title: rusher, split: null },
        ])
    })

    it('gives a solo holder without a title a null title', () => {
        const untitled: WRHolder = { user_id: '123456789012', alias: 'Solo', cap_id: 'cap-solo' }

        expect(wrHolderLines(untitled, false)).toEqual([
            { userId: '123456789012', alias: 'Solo', title: null, split: null },
        ])
    })

    it('gives a team holder one line per member, fastest first, with formatted splits', () => {
        const teamHolder: WRHolder = {
            user_id: '',
            alias: 'Alpha, Bravo, Charlie',
            cap_id: 'cap-team',
            members: [
                member('111111111111', 'Alpha', 21.5),
                member('222222222222', 'Bravo', 19.25, legend),
                member('333333333333', 'Charlie', 21.5),
            ],
        }

        expect(wrHolderLines(teamHolder, true)).toEqual([
            { userId: '222222222222', alias: 'Bravo', title: legend, split: '00:19.250' },
            { userId: '111111111111', alias: 'Alpha', title: null, split: '00:21.500' },
            { userId: '333333333333', alias: 'Charlie', title: null, split: '00:21.500' },
        ])
    })

    it('formats splits of an hour or more with hours', () => {
        const teamHolder: WRHolder = { user_id: '', alias: 'Alpha', members: [member('a', 'Alpha', 3725.5)] }

        expect(wrHolderLines(teamHolder, true)?.[0].split).toBe('1:02:05.500')
    })

    it('gives nothing for a team holder without members, so the joined alias never shows', () => {
        const joined: WRHolder = { user_id: '', alias: 'Alpha, Bravo', cap_id: 'cap-team' }

        expect(wrHolderLines(joined, true)).toBeNull()
        expect(wrHolderLines({ ...joined, members: [] }, true)).toBeNull()
    })

    it('builds the lines of a team record straight from the batch fetch', () => {
        const holder = toWRHolder(teamRecord([
            apiMember('111111111111', 'Alpha', 21.5),
            apiMember('222222222222', 'Bravo', 19.25),
        ]))

        const lines = wrHolderLines(holder, true)

        expect(lines?.map(line => line.alias)).toEqual(['Bravo', 'Alpha'])
        expect(lines?.some(line => line.alias === 'Alpha, Bravo, Charlie')).toBe(false)
    })
})
