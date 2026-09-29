import { useEffect, useId, useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { StreamCard, StreamLoading } from '../../StreamCard'
import { useStreamTab } from '../../StreamTabContext'
import {
    CASTERS_MAX,
    CASTER_NAME_MAX,
    addNamedCaster,
    addUserCaster,
    canAddCaster,
    casterPayload,
    castersFromDesk,
    moveCaster,
    pickableVolunteers,
    removeCaster,
    type CasterEntry,
} from './casterList'
import { fetchCastingVolunteers, setMatchCasters, type CastingVolunteer } from './showActions'
import { showErrorText, useShowWrite } from './useShowWrite'

const TITLE = 'Casters'
const DESCRIPTION = 'Named on the Caster Cam scene and in the credits. Pick a casting volunteer or type a name.'

const ACTION_SHAPE = 'h-9 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50 sm:h-8'
const ACCENT_ACTION = 'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:border-accent-500/60'
const ICON_ACTION = 'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-hairline/10 bg-card/50 text-muted-foreground transition-colors hover:border-hairline/20 hover:text-foreground disabled:cursor-default disabled:opacity-40 sm:size-8'
const FIELD_SHAPE = 'h-9 min-w-0 flex-1 rounded-md border border-hairline/10 bg-card/40 px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-accent-500/60 disabled:opacity-60'

interface VolunteerState {
    volunteers: CastingVolunteer[]
    error: string | null
}

function useCastingVolunteers(accessToken: string, slug: string): VolunteerState {
    const [state, setState] = useState<VolunteerState>({ volunteers: [], error: null })

    useEffect(() => {
        const controller = new AbortController()
        fetchCastingVolunteers(accessToken, slug, controller.signal)
            .then(volunteers => setState({ volunteers, error: null }))
            .catch(error => {
                if (!controller.signal.aborted) setState({ volunteers: [], error: showErrorText(error) })
            })
        return () => controller.abort()
    }, [accessToken, slug])

    return state
}

function CasterRow({ entry, index, count, disabled, onMove, onRemove }: {
    entry: CasterEntry
    index: number
    count: number
    disabled: boolean
    onMove: (index: number, offset: -1 | 1) => void
    onRemove: (index: number) => void
}) {
    const label = entry.name || 'caster'

    return (
        <li className="flex items-center justify-between gap-2 rounded-lg border border-hairline/10 bg-card/30 p-2">
            <div className="min-w-0 flex-1">
                <PlayerInfo userId={entry.userId ?? undefined} alias={entry.name} size="sm" interactive={false} />
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <button type="button" aria-label={`Move ${label} up`} disabled={disabled || index === 0} onClick={() => onMove(index, -1)} className={ICON_ACTION}>
                    <ArrowUp className="size-4" />
                </button>
                <button type="button" aria-label={`Move ${label} down`} disabled={disabled || index === count - 1} onClick={() => onMove(index, 1)} className={ICON_ACTION}>
                    <ArrowDown className="size-4" />
                </button>
                <button type="button" aria-label={`Remove ${label}`} disabled={disabled} onClick={() => onRemove(index)} className={ICON_ACTION}>
                    <X className="size-4" />
                </button>
            </div>
        </li>
    )
}

export function CastersSection() {
    const { eventSlug, accessToken, desk } = useStreamTab()
    const { run, pending, error } = useShowWrite()
    const { volunteers, error: volunteersError } = useCastingVolunteers(accessToken, eventSlug)
    const selectId = useId()
    const nameId = useId()
    const [chosen, setChosen] = useState('')
    const [typed, setTyped] = useState('')

    if (!desk) {
        return (
            <StreamCard title={TITLE} description={DESCRIPTION}>
                <StreamLoading label="your casters" />
            </StreamCard>
        )
    }

    const match = desk.match

    if (!match) {
        return (
            <StreamCard title={TITLE} description={DESCRIPTION}>
                <p className="text-xs text-muted-foreground">Casters are set per match. Once a match is on your scenes you can name them here.</p>
            </StreamCard>
        )
    }

    const entries = castersFromDesk(match.casters)
    const pickable = pickableVolunteers(volunteers, entries)
    const full = !canAddCaster(entries)
    const save = (next: CasterEntry[]) => run(() => setMatchCasters(accessToken, eventSlug, match.id, casterPayload(next)))

    const addVolunteer = async () => {
        const volunteer = pickable.find(candidate => candidate.id === chosen)
        if (volunteer && await save(addUserCaster(entries, volunteer.id, volunteer.display_name ?? ''))) setChosen('')
    }

    const addTyped = async () => {
        if (await save(addNamedCaster(entries, typed))) setTyped('')
    }

    return (
        <StreamCard title={TITLE} description={DESCRIPTION}>
            {entries.length === 0 ? (
                <p className="text-xs text-muted-foreground">No casters named for this match.</p>
            ) : (
                <ul aria-label="Casters" className="space-y-2">
                    {entries.map((entry, index) => (
                        <CasterRow
                            key={`${entry.userId ?? 'name'}:${entry.name}:${index}`}
                            entry={entry}
                            index={index}
                            count={entries.length}
                            disabled={pending}
                            onMove={(from, offset) => void save(moveCaster(entries, from, offset))}
                            onRemove={position => void save(removeCaster(entries, position))}
                        />
                    ))}
                </ul>
            )}

            {full ? (
                <p className="text-xs text-muted-foreground">Up to {CASTERS_MAX} casters. Remove one to add another.</p>
            ) : (
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <label htmlFor={selectId} className="text-xs font-medium text-foreground">Casting volunteer</label>
                        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                            <select
                                id={selectId}
                                value={chosen}
                                onChange={event => setChosen(event.target.value)}
                                disabled={pending || pickable.length === 0}
                                style={{ colorScheme: 'dark' }}
                                className={FIELD_SHAPE}
                            >
                                <option value="">{pickable.length === 0 ? 'No casting volunteers to add' : 'Choose a volunteer'}</option>
                                {pickable.map(volunteer => (
                                    <option key={volunteer.id} value={volunteer.id}>{volunteer.display_name ?? volunteer.id}</option>
                                ))}
                            </select>
                            <button type="button" disabled={pending || !chosen} onClick={() => void addVolunteer()} className={cn(ACTION_SHAPE, ACCENT_ACTION)}>
                                Add volunteer
                            </button>
                        </div>
                        {volunteersError && <p className="text-xs text-amber-300">Could not load the casting volunteers. {volunteersError}</p>}
                    </div>

                    <form
                        className="space-y-1.5"
                        onSubmit={event => {
                            event.preventDefault()
                            if (typed.trim() && !pending) void addTyped()
                        }}
                    >
                        <label htmlFor={nameId} className="text-xs font-medium text-foreground">Or type a name</label>
                        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                            <input
                                id={nameId}
                                type="text"
                                value={typed}
                                maxLength={CASTER_NAME_MAX}
                                onChange={event => setTyped(event.target.value)}
                                disabled={pending}
                                autoComplete="off"
                                className={FIELD_SHAPE}
                            />
                            <button type="submit" disabled={pending || !typed.trim()} className={cn(ACTION_SHAPE, ACCENT_ACTION)}>
                                Add name
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        </StreamCard>
    )
}
