import { describe, expect, it } from 'vitest'
import { hasPlayerGameProcess, parseTasklistPids } from './game-processes'

const TASKLIST = [
    '"UnrealTournament.exe","4120","Console","1","412,300 K"',
    '"UnrealTournament.exe","5236","Console","1","388,112 K"',
    '',
].join('\r\n')

describe('parseTasklistPids', () => {
    it('reads the PID column of each process row', () => {
        expect(parseTasklistPids(TASKLIST)).toEqual([4120, 5236])
    })

    it('returns nothing when tasklist reports no match', () => {
        expect(parseTasklistPids('INFO: No tasks are running which match the specified criteria.\r\n')).toEqual([])
    })

    it('returns nothing for empty output', () => {
        expect(parseTasklistPids('')).toEqual([])
    })
})

describe('hasPlayerGameProcess', () => {
    it('is false when every running client is a cam', () => {
        expect(hasPlayerGameProcess([4120, 5236], new Set([4120, 5236]))).toBe(false)
    })

    it('is true when a client other than the cams runs', () => {
        expect(hasPlayerGameProcess([4120, 5236, 6000], new Set([4120, 5236]))).toBe(true)
    })

    it('is false when nothing runs', () => {
        expect(hasPlayerGameProcess([], new Set())).toBe(false)
    })
})
