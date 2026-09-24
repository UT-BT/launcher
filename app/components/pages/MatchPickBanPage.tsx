import { ArrowLeft, Swords } from 'lucide-react'
import { NavLink } from '@/app/components/navigation/NavLink'
import type { UserProfile } from '@/app/utils/api'

interface MatchPickBanPageProps {
    eventSlug: string
    matchId: string
    userProfile?: UserProfile
    onBackToEvent: () => void
}

export function MatchPickBanPage({ eventSlug, matchId, onBackToEvent }: MatchPickBanPageProps) {
    return (
        <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-4">
                <NavLink
                    view="event-detail"
                    params={{ eventSlug }}
                    onActivate={onBackToEvent}
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    Back to event
                </NavLink>
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-hairline/10 bg-card/40 py-24 text-center">
                    <Swords className="size-8 text-muted-foreground" />
                    <h1 className="text-lg font-semibold text-foreground">Pick/Ban</h1>
                    <p className="max-w-sm text-sm text-muted-foreground">
                        This match&apos;s pick/ban session isn&apos;t live here yet — check back soon.
                    </p>
                    <p className="text-xs text-muted-foreground/70">Match {matchId}</p>
                </div>
            </div>
        </div>
    )
}
