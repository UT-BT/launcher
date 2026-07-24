import { History } from 'lucide-react'
import { Tooltip } from '@/app/components/ui/tooltip'

interface WorldRecordHistoryTriggerProps {
    onClick: () => void
}

export function WorldRecordHistoryTrigger({ onClick }: WorldRecordHistoryTriggerProps) {
    return (
        <Tooltip content="View WR history" side="top">
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation()
                    onClick()
                }}
                aria-label="View world record history"
                className="inline-flex items-center justify-center size-6 rounded-md text-accent-300/80 hover:text-accent-200 hover:bg-accent-500/15 transition-colors cursor-pointer"
            >
                <History className="size-3.5" />
            </button>
        </Tooltip>
    )
}
