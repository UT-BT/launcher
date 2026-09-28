import type { EventBracket } from '@/app/utils/api'

export interface PublicSchedulePanelProps {
    bracket: EventBracket | null
    loading: boolean
    eventSlug: string
    myTeamId: string | null
}

const SKELETON_ROWS = 4

export function PublicSchedulePanel({ loading }: PublicSchedulePanelProps) {
    return (
        <section aria-label="All Matches" aria-busy={loading} className="flex flex-col gap-2">
            {loading ? (
                <>
                    <span className="sr-only">Loading schedule…</span>
                    <div aria-hidden className="h-3 w-24 rounded bg-hairline/10" />
                    {Array.from({ length: SKELETON_ROWS }, (_, index) => (
                        <div key={index} aria-hidden className="h-16 rounded-lg border border-hairline/5 bg-card/30" />
                    ))}
                </>
            ) : (
                <p className="p-6 text-center text-sm text-muted-foreground">No matches scheduled yet.</p>
            )}
        </section>
    )
}
