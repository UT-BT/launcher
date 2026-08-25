import { useEffect, useMemo, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActionButton } from '@/app/components/pages/admin/components/controls'
import { useNavState } from '@/app/components/navigation/useNavState'
import { ErrorBanner, SectionCard } from '@/app/components/pages/teams/teamsShared'
import { TeamName } from '../TeamRoster'
import { eventErrorMessage, setEventSeeds, type EventTeam } from '@/app/utils/api'

interface SeedingPanelProps {
    accessToken: string
    slug: string
    teams: EventTeam[]
    tierSize: number | null
    onSaved: () => void
}

interface Row {
    id: string
    name: string
    seed: number | null
}

function sortRows(rows: Row[]): Row[] {
    return [...rows].sort((a, b) => {
        if (a.seed == null && b.seed == null) return a.name.localeCompare(b.name)
        if (a.seed == null) return 1
        if (b.seed == null) return -1
        return a.seed - b.seed
    })
}

export function SeedingPanel({ accessToken, slug, teams, tierSize, onSaved }: SeedingPanelProps) {
    const registered = useMemo(
        () => teams.filter(team => team.status === 'registered' || team.status === 'pending'),
        [teams],
    )

    const [rows, setRows] = useState<Row[]>([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [dirty, setDirty] = useState(false)
    const [dragId, setDragId] = useState<string | null>(null)
    const [open, setOpen] = useNavState('event.manage.seeding', false)
    const listRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setRows(sortRows(registered.map(team => ({ id: team.id, name: team.name, seed: team.seed }))))
        setDirty(false)
    }, [registered])

    // The order is the seeding, so a move renumbers everything under it.
    const moveTo = (from: number, to: number) => {
        if (from === to) return

        setRows(current => {
            if (from < 0 || to < 0 || from >= current.length || to >= current.length) return current

            const next = [...current]
            const [moved] = next.splice(from, 1)
            next.splice(to, 0, moved)
            return next.map((row, at) => ({ ...row, seed: at + 1 }))
        })
        setDirty(true)
    }

    const rowUnderPointer = (clientY: number) => {
        const items = Array.from(listRef.current?.children ?? []) as HTMLElement[]
        return items.findIndex(item => {
            const rect = item.getBoundingClientRect()
            return clientY >= rect.top && clientY <= rect.bottom
        })
    }

    // Listening on the window, not the handle: reordering moves the handle's DOM
    // node, and a moved node loses its pointer capture — which would end the drag
    // after a single swap.
    const rowsRef = useRef(rows)
    rowsRef.current = rows

    useEffect(() => {
        if (!dragId) return

        const onMove = (event: PointerEvent) => {
            const from = rowsRef.current.findIndex(row => row.id === dragId)
            const to = rowUnderPointer(event.clientY)

            if (from >= 0 && to >= 0) moveTo(from, to)
        }

        const stop = () => setDragId(null)

        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', stop)
        window.addEventListener('pointercancel', stop)

        return () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', stop)
            window.removeEventListener('pointercancel', stop)
        }
    }, [dragId])

    const numberInOrder = () => {
        setRows(current => current.map((row, index) => ({ ...row, seed: index + 1 })))
        setDirty(true)
    }

    const clearAll = () => {
        setRows(current => current.map(row => ({ ...row, seed: null })))
        setDirty(true)
    }

    const save = async () => {
        setBusy(true)
        setError(null)
        try {
            await setEventSeeds(accessToken, slug, rows.map(row => ({ team_id: row.id, seed: row.seed })))
            setDirty(false)
            onSaved()
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    return (
        <SectionCard
            title="Seeding"
            subtitle={`${rows.length} team${rows.length === 1 ? '' : 's'}, strongest first`}
            collapsible
            open={open}
            onOpenChange={setOpen}
            action={
                <div className="flex flex-wrap items-center gap-2">
                    <ActionButton onClick={numberInOrder} disabled={busy}>Renumber</ActionButton>
                    <ActionButton onClick={clearAll} disabled={busy}>Clear</ActionButton>
                    <ActionButton tone="emerald" onClick={() => void save()} loading={busy} disabled={!dirty}>Save</ActionButton>
                </div>
            }
        >
            <ErrorBanner message={error} />

            <p className="text-[11px] text-muted-foreground">
                Drag a row by its handle to reorder. Seed 1 is the strongest team and seeds settle
                standings ties{tierSize ? `; tiers of ${tierSize} are split one per group` : ''}.
            </p>

            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teams to seed yet.</p>
            ) : (
                <div ref={listRef} className={cn('space-y-0.5', dragId && 'select-none cursor-grabbing')}>
                    {rows.map((row, index) => {
                        const tier = tierSize && row.seed ? Math.ceil(row.seed / tierSize) : null

                        return (
                            <div
                                key={row.id}
                                className={cn(
                                    'flex items-center gap-2 rounded-md px-1.5 py-1.5 min-w-0 transition-colors',
                                    dragId === row.id ? 'bg-accent-500/10 ring-1 ring-accent-400/40' : 'hover:bg-white/5',
                                )}
                            >
                                <span className="w-7 shrink-0 text-center text-sm tabular-nums text-muted-foreground">
                                    {row.seed ?? '—'}
                                </span>
                                <TeamName teamId={row.id} className="truncate text-sm text-foreground">
                                    {row.name}
                                </TeamName>
                                {tier != null && (
                                    <span className="shrink-0 text-[10px] text-muted-foreground/70">tier {tier}</span>
                                )}
                                <button
                                    type="button"
                                    aria-label={`Reorder ${row.name}`}
                                    title="Drag to reorder"
                                    disabled={busy}
                                    onPointerDown={event => {
                                        event.preventDefault()
                                        setDragId(row.id)
                                    }}
                                    onKeyDown={event => {
                                        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                                        event.preventDefault()
                                        moveTo(index, index + (event.key === 'ArrowUp' ? -1 : 1))
                                    }}
                                    className="ml-auto shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 cursor-grab touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60 disabled:opacity-40 active:cursor-grabbing"
                                >
                                    <GripVertical className="size-4" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </SectionCard>
    )
}
