import { describe, expect, it } from 'vitest'
import { localInputFromInstant, timeZoneLabel, utcFromLocalInput } from './localTime'

describe('utcFromLocalInput', () => {
    it('reads a local wall time east of UTC', () => {
        expect(utcFromLocalInput('2026-09-26T22:30', 'Europe/Budapest')).toEqual({ status: 'ok', iso: '2026-09-26T20:30:00Z', ambiguous: false })
        expect(utcFromLocalInput('2026-01-15T22:30', 'Europe/Budapest')).toEqual({ status: 'ok', iso: '2026-01-15T21:30:00Z', ambiguous: false })
        expect(utcFromLocalInput('2026-09-27T08:00', 'Asia/Tokyo')).toEqual({ status: 'ok', iso: '2026-09-26T23:00:00Z', ambiguous: false })
    })

    it('reads a local wall time west of UTC', () => {
        expect(utcFromLocalInput('2026-07-04T20:00', 'America/New_York')).toEqual({ status: 'ok', iso: '2026-07-05T00:00:00Z', ambiguous: false })
        expect(utcFromLocalInput('2026-12-04T20:00', 'America/New_York')).toEqual({ status: 'ok', iso: '2026-12-05T01:00:00Z', ambiguous: false })
    })

    it('reads a half-hour zone', () => {
        expect(utcFromLocalInput('2026-09-26T12:00', 'Asia/Kolkata')).toEqual({ status: 'ok', iso: '2026-09-26T06:30:00Z', ambiguous: false })
    })

    it('keeps UTC as it is', () => {
        expect(utcFromLocalInput('2026-09-26T21:15', 'UTC')).toEqual({ status: 'ok', iso: '2026-09-26T21:15:00Z', ambiguous: false })
    })

    it('refuses a time that falls in the spring-forward gap', () => {
        expect(utcFromLocalInput('2026-03-29T02:30', 'Europe/Budapest')).toEqual({ status: 'gap' })
        expect(utcFromLocalInput('2026-03-08T02:30', 'America/New_York')).toEqual({ status: 'gap' })
    })

    it('accepts the minutes either side of the gap', () => {
        expect(utcFromLocalInput('2026-03-29T01:59', 'Europe/Budapest')).toMatchObject({ status: 'ok', iso: '2026-03-29T00:59:00Z' })
        expect(utcFromLocalInput('2026-03-29T03:00', 'Europe/Budapest')).toMatchObject({ status: 'ok', iso: '2026-03-29T01:00:00Z' })
    })

    it('takes the first of the two instants in the autumn overlap', () => {
        expect(utcFromLocalInput('2026-10-25T02:30', 'Europe/Budapest')).toEqual({ status: 'ok', iso: '2026-10-25T00:30:00Z', ambiguous: true })
        expect(utcFromLocalInput('2026-11-01T01:30', 'America/New_York')).toEqual({ status: 'ok', iso: '2026-11-01T05:30:00Z', ambiguous: true })
    })

    it('does not flag the hours around the overlap', () => {
        expect(utcFromLocalInput('2026-10-25T01:59', 'Europe/Budapest')).toMatchObject({ ambiguous: false, iso: '2026-10-24T23:59:00Z' })
        expect(utcFromLocalInput('2026-10-25T03:00', 'Europe/Budapest')).toMatchObject({ ambiguous: false, iso: '2026-10-25T02:00:00Z' })
    })

    it('rejects an empty or impossible time', () => {
        expect(utcFromLocalInput('', 'UTC')).toEqual({ status: 'invalid' })
        expect(utcFromLocalInput('2026-02-30T10:00', 'UTC')).toEqual({ status: 'invalid' })
        expect(utcFromLocalInput('2026-09-26T24:00', 'UTC')).toEqual({ status: 'invalid' })
        expect(utcFromLocalInput('tomorrow', 'UTC')).toEqual({ status: 'invalid' })
    })
})

describe('localInputFromInstant', () => {
    it('writes an instant as the wall time of the zone', () => {
        expect(localInputFromInstant('2026-09-26T20:30:00+00:00', 'Europe/Budapest')).toBe('2026-09-26T22:30')
        expect(localInputFromInstant('2026-07-05T00:00:00Z', 'America/New_York')).toBe('2026-07-04T20:00')
        expect(localInputFromInstant('2026-09-26T20:30:00Z', 'UTC')).toBe('2026-09-26T20:30')
    })

    it('writes both instants of the overlap as the same wall time', () => {
        expect(localInputFromInstant('2026-10-25T00:30:00Z', 'Europe/Budapest')).toBe('2026-10-25T02:30')
        expect(localInputFromInstant('2026-10-25T01:30:00Z', 'Europe/Budapest')).toBe('2026-10-25T02:30')
    })

    it('has nothing for a missing instant', () => {
        expect(localInputFromInstant(null, 'UTC')).toBe('')
    })

    it('round-trips through the parser', () => {
        const local = localInputFromInstant('2026-03-29T01:00:00Z', 'Europe/Budapest')
        expect(local).toBe('2026-03-29T03:00')
        expect(utcFromLocalInput(local, 'Europe/Budapest')).toMatchObject({ iso: '2026-03-29T01:00:00Z' })
    })
})

describe('timeZoneLabel', () => {
    it('names the zone and its abbreviation on that date', () => {
        expect(timeZoneLabel('Europe/Budapest', Date.parse('2026-07-01T12:00:00Z'))).toBe('Europe/Budapest (CEST)')
        expect(timeZoneLabel('Europe/Budapest', Date.parse('2026-01-01T12:00:00Z'))).toBe('Europe/Budapest (CET)')
        expect(timeZoneLabel('America/New_York', Date.parse('2026-07-01T12:00:00Z'))).toBe('America/New_York (EDT)')
    })

    it('names UTC once', () => {
        expect(timeZoneLabel('UTC', Date.parse('2026-07-01T12:00:00Z'))).toBe('UTC')
    })
})
