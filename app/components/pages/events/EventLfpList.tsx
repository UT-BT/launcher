import { Clock, Globe, UserSearch } from 'lucide-react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import type { EventLfpEntry } from '@/app/utils/api'

interface EventLfpListProps {
    entries: EventLfpEntry[]
    loading: boolean
}

export function EventLfpList({ entries, loading }: EventLfpListProps) {
    if (loading && entries.length === 0) {
        return <div className="py-10 text-center text-sm text-muted-foreground">Loading players…</div>
    }

    if (entries.length === 0) {
        return (
            <div className="py-10 text-center text-sm text-muted-foreground">
                <UserSearch className="size-8 mx-auto mb-2 opacity-40" />
                Nobody is looking for a partner right now.
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
                These players want to play but need a teammate. Know one of them? Team up!
            </p>
            {entries.map(entry => (
                <div key={entry.user} className="p-3 rounded-xl bg-card/30 border border-hairline/5 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <PlayerInfo userId={entry.user} alias={entry.alias} size="sm" />
                    <div className="text-[11px] text-muted-foreground min-w-0 flex-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {entry.timezone && <span className="inline-flex items-center gap-1"><Globe className="size-3" /> {entry.timezone}</span>}
                        {entry.availability && <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {entry.availability}</span>}
                        {entry.note && <span className="italic">“{entry.note}”</span>}
                    </div>
                </div>
            ))}
        </div>
    )
}
