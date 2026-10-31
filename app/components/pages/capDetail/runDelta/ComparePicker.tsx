import { Info } from 'lucide-react'
import { Spinner } from '@/app/components/ui/spinner'
import { Tooltip } from '@/app/components/ui/tooltip'
import type { CapCompareCandidate } from '@/app/utils/api'
import { candidateOptionLabel, candidateTag } from './compareCandidates'

interface ComparePickerProps {
    candidates: CapCompareCandidate[]
    capHasReplay: boolean | undefined
    selectedId: string | null
    onSelect: (id: string | null) => void
    busy: boolean
}

export function ComparePicker({ candidates, capHasReplay, selectedId, onSelect, busy }: ComparePickerProps) {
    return (
        <div className="flex items-center gap-2 w-full lg:w-auto">
            {busy && <Spinner className="size-3.5 text-muted-foreground shrink-0" />}
            <label
                htmlFor="checkpoint-compare-target"
                className="text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap"
            >
                compare vs
            </label>
            <Tooltip content="You can only compare against runs done on the same team. Checkpoint zones are mirrored per team, so cross-team splits don't line up." side="top">
                <button type="button" aria-label="Which runs you can compare against" className="inline-flex cursor-pointer">
                    <Info className="size-3 text-muted-foreground/60" />
                </button>
            </Tooltip>
            <select
                id="checkpoint-compare-target"
                value={selectedId ?? ''}
                onChange={(e) => onSelect(e.target.value || null)}
                style={{ colorScheme: 'dark' }}
                className="h-9 lg:h-7 flex-1 lg:flex-none min-w-0 rounded-md bg-card/60 border border-hairline/10 text-xs text-foreground px-2 hover:border-hairline/20 focus:outline-none focus:border-accent-500/50 cursor-pointer lg:max-w-[16rem]"
            >
                {candidates.map(c => (
                    <option key={c.id} value={c.id}>{candidateOptionLabel(c, candidateTag(capHasReplay, c))}</option>
                ))}
            </select>
        </div>
    )
}
