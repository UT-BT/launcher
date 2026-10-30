import { describe, expect, it } from 'vitest'
import { afterRemoval, INITIAL_LEGACY_INSTALL, type LegacyInstallSnapshot } from './legacyInstall'

const removing: LegacyInstallSnapshot = {
    ...INITIAL_LEGACY_INSTALL,
    uninstallerName: 'Uninstall utbt.exe',
    cardOpen: true,
    phase: 'removing',
}

describe('afterRemoval', () => {
    it('forgets the old copy once it is removed and keeps the pin warning', () => {
        expect(afterRemoval(removing, { outcome: 'removed', pinLost: true })).toEqual({
            uninstallerName: null,
            cardOpen: true,
            phase: 'removed',
            pinLost: true,
        })
    })

    it('treats an old copy that was already gone as removed', () => {
        expect(afterRemoval(removing, { outcome: 'gone' })).toMatchObject({ uninstallerName: null, phase: 'removed', pinLost: false })
    })

    it.each(['declined', 'failed'] as const)('keeps offering the old copy after it was %s', (outcome) => {
        expect(afterRemoval(removing, { outcome })).toMatchObject({ uninstallerName: 'Uninstall utbt.exe', phase: outcome })
    })
})
