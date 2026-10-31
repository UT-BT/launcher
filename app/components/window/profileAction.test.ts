import { describe, expect, it } from 'vitest'
import { runProfileAction } from './profileAction'

const refusedOverIpc = (channel: string, name: string) =>
    new Error(`Error invoking remote method '${channel}': Error: Profile name "${name}" is reserved`)

describe('runProfileAction', () => {
    it('answers null when the action succeeds', async () => {
        expect(await runProfileAction(async () => undefined)).toBeNull()
    })

    it('shows the refusal of a reserved name on create without the IPC wrapper', async () => {
        const message = await runProfileAction(async () => { throw refusedOverIpc('createProfile', 'Original') })
        expect(message).toBe('Profile name "Original" is reserved')
    })

    it('shows the refusal of a reserved name on rename without the IPC wrapper', async () => {
        const message = await runProfileAction(async () => { throw refusedOverIpc('renameProfile', 'Original (2)') })
        expect(message).toBe('Profile name "Original (2)" is reserved')
    })

    it('keeps a message that did not cross IPC as it is', async () => {
        const message = await runProfileAction(async () => { throw new Error('Profile "Mine" not found') })
        expect(message).toBe('Profile "Mine" not found')
    })

    it('falls back to a generic message when the rejection carries none', async () => {
        expect(await runProfileAction(() => Promise.reject('nope'))).toBe('The profile action failed.')
        expect(await runProfileAction(async () => { throw new Error('') })).toBe('The profile action failed.')
    })
})
