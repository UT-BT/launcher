import { useId } from 'react'
import { Users2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TEAM_SORTS, type TeamCardView, type TeamSortKey } from './statsView'
import { TeamCard } from './TeamCard'
import './teamCards.css'

interface TeamSortControlProps {
    value: TeamSortKey
    onChange: (key: TeamSortKey) => void
}

export function TeamSortControl({ value, onChange }: TeamSortControlProps) {
    const labelId = useId()
    return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span id={labelId}>Sort teams</span>
            <div role="group" aria-labelledby={labelId} className="flex overflow-hidden rounded-lg border border-hairline/15">
                {TEAM_SORTS.map(sort => (
                    <button
                        key={sort.key}
                        type="button"
                        aria-pressed={value === sort.key}
                        onClick={() => onChange(sort.key)}
                        className={cn(
                            'h-8 px-2.5 text-xs font-medium transition-colors cursor-pointer',
                            value === sort.key ? 'bg-hairline/10 text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {sort.label}
                    </button>
                ))}
            </div>
        </div>
    )
}

interface TeamCardsGridProps {
    cards: TeamCardView[]
    eventSlug: string
}

export function TeamCardsGrid({ cards, eventSlug }: TeamCardsGridProps) {
    if (cards.length === 0) {
        return (
            <div className="rounded-xl border border-hairline/10 bg-card/30 py-10 text-center text-sm text-muted-foreground">
                <Users2 className="mx-auto mb-2 size-8 opacity-40" />
                No teams in this stage yet.
            </div>
        )
    }

    return (
        <div className="team-cards grid gap-3">
            {cards.map(card => <TeamCard key={card.id} card={card} eventSlug={eventSlug} />)}
        </div>
    )
}
