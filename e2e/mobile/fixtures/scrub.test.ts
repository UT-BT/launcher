import { describe, expect, it } from 'vitest'
import { scrubRecorded } from './scrub'

describe('scrubRecorded', () => {
    it('drops credential, contact and hardware fields wherever they sit', () => {
        const body = {
            success: true,
            data: {
                alias: 'Velocity',
                email: 'someone@mail.test',
                access_token: 'abc',
                refreshToken: 'def',
                hwid: 'XYZ-123',
                hardware_id: 'XYZ-456',
                rows: [{ id: 1, secret: 's', password: 'p', cap_time_seconds: 41.2 }],
            },
        }
        expect(scrubRecorded(body)).toEqual({
            success: true,
            data: { alias: 'Velocity', rows: [{ id: 1, cap_time_seconds: 41.2 }] },
        })
    })

    it('replaces addresses with documentation-range ones, the same address with the same replacement', () => {
        const body = [
            { ip: '203.0.113.9', hostname: 'BT Server', hostport: 7777 },
            { ip: '198.51.100.7', hostname: 'Other', hostport: 7777 },
            { ip: '198.51.100.7', address: 'unreal://198.51.100.7:7777' },
        ]
        expect(scrubRecorded(body)).toEqual([
            { ip: '192.0.2.1', hostname: 'BT Server', hostport: 7777 },
            { ip: '192.0.2.2', hostname: 'Other', hostport: 7777 },
            { ip: '192.0.2.2', address: 'unreal://192.0.2.2:7777' },
        ])
    })

    it('blanks an email address inside free text and leaves version numbers alone', () => {
        expect(scrubRecorded({ body: 'Mail me at runner@example.org please', version: '469e', build: '1.30.0' }))
            .toEqual({ body: 'Mail me at [email removed] please', version: '469e', build: '1.30.0' })
    })

    it('keeps public identifiers and counts', () => {
        const body = { user: '123456789012345678', avatar: 'https://cdn.example.test/a.png', count: 12, token_count: undefined }
        expect(scrubRecorded(body)).toEqual({ user: '123456789012345678', avatar: 'https://cdn.example.test/a.png', count: 12 })
    })

    it('drops fields the public client never reads, but keeps data-shaped keys such as map names and ids', () => {
        const shown = new Set(['alias', 'cap_time_seconds', 'per_map'])
        const body = {
            alias: 'Velocity',
            cap_time_seconds: 41.2,
            jump_burst_50pc: 3,
            per_map: { 'CTF-BT-Aurora': 2, '123456789': 1 },
        }
        expect(scrubRecorded(body, new Map(), key => shown.has(key))).toEqual({
            alias: 'Velocity',
            cap_time_seconds: 41.2,
            per_map: { 'CTF-BT-Aurora': 2, '123456789': 1 },
        })
    })

    it('drops client identifiers and anti-cheat measurements even when the client knows them', () => {
        expect(scrubRecorded({ id: 'c1', btpog_id: 'X1', client_cap_delta: 0.003, set_fps_min: 60, set_fps_max: 200 })).toEqual({ id: 'c1' })
    })
})
