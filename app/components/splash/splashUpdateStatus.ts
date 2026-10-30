import type { UpdaterStateSnapshot } from '@/lib/conveyor/schemas/updater-schema'

export type SplashUpdateStatus =
  | { kind: 'checking'; label: string }
  | { kind: 'downloading'; label: string; percent: number }
  | { kind: 'restarting'; label: string }

type SplashUpdateInput = Pick<UpdaterStateSnapshot, 'holdingLaunch' | 'phase' | 'version' | 'progressPercent'>

export function splashUpdateStatus(state: SplashUpdateInput): SplashUpdateStatus | null {
  if (!state.holdingLaunch) return null
  switch (state.phase) {
    case 'available':
    case 'downloading':
      return {
        kind: 'downloading',
        label: state.version ? `Updating to v${state.version}` : 'Updating UTBT',
        percent: Math.max(0, Math.min(100, Math.round(state.progressPercent ?? 0))),
      }
    case 'downloaded':
    case 'installing':
      return { kind: 'restarting', label: 'Restarting to finish the update' }
    default:
      return { kind: 'checking', label: 'Checking for updates' }
  }
}
