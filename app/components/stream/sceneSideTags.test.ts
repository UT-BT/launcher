import { describe, expect, it } from 'vitest'
import { streamSidesFixture } from '@/app/utils/fixtures/streamSidesFixtures'
import { sceneSideTags } from './sceneSideTags'

describe('sceneSideTags', () => {
    it('labels the top team RED and the bottom team BLUE once the side is confirmed', () => {
        expect(sceneSideTags({ confirmed: true, source: 'step0' })).toEqual({
            a: { label: 'RED', tone: 'a', confirmed: true },
            b: { label: 'BLUE', tone: 'b', confirmed: true },
        })
    })

    it('says Sides TBC in a neutral tone for both teams while the side is unconfirmed', () => {
        expect(sceneSideTags({ confirmed: false, source: null })).toEqual({
            a: { label: 'Sides TBC', tone: 'neutral', confirmed: false },
            b: { label: 'Sides TBC', tone: 'neutral', confirmed: false },
        })
    })

    it('reads the hot state’s side status as the contract sends it', () => {
        const match = streamSidesFixture('streamState').match

        expect(match?.side_status).toEqual({ confirmed: false, source: null })
        expect(sceneSideTags(match!.side_status).a.label).toBe('Sides TBC')
    })
})
