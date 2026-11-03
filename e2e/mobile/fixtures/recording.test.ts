import { describe, expect, it } from 'vitest'
import { addResponse, emptyRecording, pickRecorded, trimRecording, type RecordedResponse } from './recording'

function recorded(path: string, query: string, data: unknown): RecordedResponse {
    return { host: 'api', path, query, status: 200, body: { success: true, data } }
}

const RECORDS: RecordedResponse[] = [
    recorded('/v2/world_records', 'count=true', { count: 9 }),
    recorded('/v2/world_records', 'limit=25&offset=0', ['first page']),
    recorded('/v2/world_records', 'limit=25&offset=25', ['second page']),
    recorded('/maps', 'added_since=2026-10-01T00%3A00%3A00.000Z&columns=name', ['new maps']),
]

function bodyFor(url: string) {
    return pickRecorded(RECORDS, new URL(url))?.body
}

describe('pickRecorded', () => {
    it('answers the exact path and query, whatever the parameter order', () => {
        expect(bodyFor('https://api.utbt.net/v2/world_records/?offset=25&limit=25')).toEqual({ success: true, data: ['second page'] })
        expect(bodyFor('https://api.utbt.net/v2/world_records/?count=true')).toEqual({ success: true, data: { count: 9 } })
    })

    it('falls back to the recording sharing the most parameters when the query moved on', () => {
        expect(bodyFor('https://api.utbt.net/v2/world_records/?limit=25&offset=50')).toEqual({ success: true, data: ['first page'] })
        expect(bodyFor('https://api.utbt.net/maps/?added_since=2026-10-30T00%3A00%3A00.000Z&columns=name')).toEqual({ success: true, data: ['new maps'] })
    })

    it('answers nothing for a path or host it never recorded', () => {
        expect(bodyFor('https://api.utbt.net/v2/players/?limit=25')).toBeUndefined()
        expect(bodyFor('https://gateway.utbt.net/v2/world_records/?count=true')).toBeUndefined()
    })
})

describe('addResponse', () => {
    it('keeps the first response per request and sorts by host, path and query', () => {
        let recording = emptyRecording('world-records')
        recording = addResponse(recording, recorded('/v2/world_records', 'limit=25&offset=0', ['late']))
        recording = addResponse(recording, { ...recorded('/server-info', '', []), host: 'gateway' })
        recording = addResponse(recording, recorded('/v2/world_records', 'count=true', { count: 1 }))
        recording = addResponse(recording, recorded('/v2/world_records', 'offset=0&limit=25', ['again']))
        expect(recording.responses.map(entry => `${entry.host} ${entry.path}?${entry.query}`)).toEqual([
            'api /v2/world_records?count=true',
            'api /v2/world_records?limit=25&offset=0',
            'gateway /server-info?',
        ])
        expect(recording.responses[1].body).toEqual({ success: true, data: ['late'] })
    })
})

describe('trimRecording', () => {
    it('cuts a long list to the limit, keeping the rows other responses mention and the list order', () => {
        const reviews = Array.from({ length: 10 }, (_, index) => ({ map_name: `CTF-BT-Map${index}`, overall: index }))
        const recording = {
            set: 'maps',
            responses: [
                recorded('/map_reviews', '', reviews),
                recorded('/maps', 'limit=2', [{ name: 'CTF-BT-Map7' }, { name: 'CTF-BT-Map3' }]),
            ],
        }
        const trimmed = trimRecording(recording, 4)
        expect((trimmed.responses[0].body as { data: unknown[] }).data).toEqual([reviews[0], reviews[1], reviews[3], reviews[7]])
        expect(trimmed.responses[1]).toEqual(recording.responses[1])
    })

    it('leaves lists within the limit alone', () => {
        const recording = { set: 'maps', responses: [recorded('/maps', '', [{ name: 'A' }, { name: 'B' }])] }
        expect(trimRecording(recording, 2)).toEqual(recording)
    })
})
