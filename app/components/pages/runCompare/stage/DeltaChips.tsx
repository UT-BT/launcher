import { useCallback } from 'react'
import { TONE_TEXT } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import { cn } from '@/lib/utils'
import { RunIdentity } from '../analysis/RunIdentity'
import { sameReadout, tileReadout, type TileOverlay, type TileReadout } from '../model/overlayModel'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'
import { BaselineTag } from './Tags'
import { usePlaybackSelector } from './usePlaybackSelector'

function DeltaChip({ overlay, controller }: { overlay: TileOverlay; controller: PlaybackController | null }) {
    const select = useCallback(
        (state: PlaybackState) => tileReadout(overlay, { seconds: state.runTimes[overlay.capId] ?? state.t, playing: state.playing }),
        [overlay],
    )
    const { delta } = usePlaybackSelector<TileReadout>(controller, select, sameReadout)
    return (
        <li className="run-compare-delta-chip">
            <RunIdentity run={overlay.run} />
            {overlay.reference && <BaselineTag />}
            {!overlay.reference && delta && <span className={cn('font-mono tabular-nums', TONE_TEXT[delta.tone])}>{delta.label}</span>}
        </li>
    )
}

interface DeltaChipsProps {
    overlays: readonly TileOverlay[]
    controller: PlaybackController | null
}

export function DeltaChips({ overlays, controller }: DeltaChipsProps) {
    if (overlays.length === 0) return null
    return (
        <ul aria-label="Other Runs" className="run-compare-delta-chips">
            {overlays.map(overlay => <DeltaChip key={overlay.capId} overlay={overlay} controller={controller} />)}
        </ul>
    )
}
