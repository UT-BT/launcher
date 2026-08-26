import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import {
    REPLAY_CONVERTING_MESSAGE,
    REPLAY_ERROR_MESSAGE,
    REPLAY_UNAVAILABLE_MESSAGE,
    replayErrorMessage,
} from './replayMessages'

describe('replay failure messages', () => {
    it('only claims a run is still processing when the pipeline says so', () => {
        expect(replayErrorMessage('converting')).toBe(REPLAY_CONVERTING_MESSAGE)
        expect(replayErrorMessage('unavailable')).not.toBe(REPLAY_CONVERTING_MESSAGE)
        expect(replayErrorMessage('error')).not.toBe(REPLAY_CONVERTING_MESSAGE)
    })

    it('tells the truth about a run that has no demo at all', () => {
        expect(replayErrorMessage('unavailable')).toBe(REPLAY_UNAVAILABLE_MESSAGE)
    })

    it('separates a transport failure from a missing replay', () => {
        expect(replayErrorMessage('error')).toBe(REPLAY_ERROR_MESSAGE)
        expect(REPLAY_ERROR_MESSAGE).not.toBe(REPLAY_UNAVAILABLE_MESSAGE)
    })

    it('never mentions the conversion pipeline outside the converting case', () => {
        for (const state of ['unavailable', 'error'] as const) {
            expect(replayErrorMessage(state).toLowerCase()).not.toContain('processed')
            expect(replayErrorMessage(state).toLowerCase()).not.toContain('converting')
        }
    })
})

const REPLAY_CALL_SITES = [
    'components/modals/ReplayPickerModal.tsx',
    'hooks/useReplayWatch.ts',
]

function callSiteSource(file: string): string {
    return readFileSync(resolve(__dirname, '..', file), 'utf8')
}

describe('every replay call site reports failures through replayErrorMessage', () => {
    it.each(REPLAY_CALL_SITES)('%s reads the resolved state, not just the url', file => {
        const source = callSiteSource(file)

        expect(source).toContain('resolveReplayForCap')
        expect(source).toMatch(/const \{ state, url \} = await resolveReplayForCap/)
        expect(source).toContain('replayErrorMessage(')
    })
})

describe('the replay picker', () => {
    const source = callSiteSource('components/modals/ReplayPickerModal.tsx')
    const watchTeamRun = source.slice(
        source.indexOf('const watchTeamRun'),
        source.indexOf('useEffect(', source.indexOf('const watchTeamRun')),
    )

    it('clears a stale failure before opening a working replay', () => {
        expect(watchTeamRun).toContain('setError(null)')
    })

    it('never collapses a mid-conversion or failed team run into "no replay"', () => {
        expect(watchTeamRun).not.toContain('No replay is available for this team run yet.')
        expect(watchTeamRun).toContain('replayErrorMessage(')
    })
})
