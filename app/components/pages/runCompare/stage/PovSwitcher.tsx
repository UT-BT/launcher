import { runName, RunIdentity } from '../analysis/RunIdentity'
import type { TileSlot } from '../model/raceModel'
import type { StageView } from '../model/phoneStage'

interface PovSwitcherProps {
    tiles: readonly TileSlot[]
    view: StageView
    onPov: (capId: string) => void
}

export function PovSwitcher({ tiles, view, onPov }: PovSwitcherProps) {
    const shown = new Set(view.visible)
    return (
        <div role="group" aria-label="Point of View" className="run-compare-pov">
            {tiles.map(slot => (
                <button
                    key={slot.id}
                    type="button"
                    aria-label={runName(slot.run)}
                    aria-pressed={shown.has(slot.id)}
                    className="run-compare-pov-chip"
                    onClick={() => onPov(slot.id)}
                >
                    <RunIdentity run={slot.run} />
                </button>
            ))}
        </div>
    )
}
