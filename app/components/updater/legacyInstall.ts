import { useSyncExternalStore } from 'react'
import { capabilities } from '@/app/platform'
import type { LegacyRemovalResult } from '@/lib/conveyor/schemas/legacy-install-schema'

export type LegacyRemovalPhase = 'idle' | 'removing' | 'removed' | 'declined' | 'failed'

export type LegacyInstallSnapshot = {
    uninstallerName: string | null
    cardOpen: boolean
    phase: LegacyRemovalPhase
    pinLost: boolean
}

export const INITIAL_LEGACY_INSTALL: LegacyInstallSnapshot = {
    uninstallerName: null,
    cardOpen: false,
    phase: 'idle',
    pinLost: false,
}

export function afterRemoval(snapshot: LegacyInstallSnapshot, result: LegacyRemovalResult): LegacyInstallSnapshot {
    if (result.outcome === 'removed') return { ...snapshot, uninstallerName: null, phase: 'removed', pinLost: result.pinLost }
    if (result.outcome === 'gone') return { ...snapshot, uninstallerName: null, phase: 'removed', pinLost: false }
    return { ...snapshot, phase: result.outcome }
}

let snapshot = INITIAL_LEGACY_INSTALL
let loaded = false
const listeners = new Set<() => void>()

function update(next: LegacyInstallSnapshot) {
    snapshot = next
    for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

function getSnapshot() {
    return snapshot
}

export function loadLegacyInstall(): void {
    if (loaded || !capabilities.updater) return
    loaded = true
    window.conveyor.legacyInstall
        .getStatus()
        .then((status) => {
            if (!status.found) return
            update({ ...snapshot, uninstallerName: status.uninstallerName, cardOpen: snapshot.cardOpen || status.offer })
        })
        .catch(() => {
            loaded = false
        })
}

export function openLegacyCard(): void {
    update({ ...snapshot, cardOpen: true, phase: 'idle' })
}

export function closeLegacyCard(): void {
    if (snapshot.phase === 'removing') return
    if (snapshot.phase === 'idle') void window.conveyor.legacyInstall.dismiss().catch(() => undefined)
    update({ ...snapshot, cardOpen: false, phase: 'idle' })
}

export async function removeLegacyCopy(): Promise<void> {
    if (snapshot.phase === 'removing') return
    update({ ...snapshot, phase: 'removing' })
    try {
        update(afterRemoval(snapshot, await window.conveyor.legacyInstall.remove()))
    } catch {
        update({ ...snapshot, phase: 'failed' })
    }
}

export function useLegacyInstall(): LegacyInstallSnapshot {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
