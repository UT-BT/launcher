import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActionButton } from '@/app/components/pages/admin/components/controls'
import { ErrorBanner, SectionCard, teamInputClass } from '@/app/components/pages/teams/teamsShared'
import { eventErrorMessage, setEventSeeds, type EventTeam } from '@/app/utils/api'

interface SeedingPanelProps {
    accessToken: string
    slug: string
    teams: EventTeam[]
    /** Teams per seeding tier — one team from each tier lands in each group. */
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

    useEffect(() => {
        setRows(sortRows(registered.map(team => ({ id: team.id, name: team.name, seed: team.seed }))))
        setDirty(false)
    }, [registered])

    const setSeed = (id: string, seed: number | null) => {
        setRows(current => current.map(row => (row.id === id ? { ...row, seed } : row)))
        setDirty(true)
    }

    const move = (index: number, delta: number) => {
        const target = index + delta
        if (target < 0 || target >= rows.length) return
        const next = [...rows]
        ;[next[index], next[target]] = [next[target], next[index]]
        setRows(next.map((row, at) => ({ ...row, seed: at + 1 })))
        setDirty(true)
    }

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

    const duplicates = useMemo(() => {
        const seen = new Set<number>()
        const clashing = new Set<number>()
        for (const row of rows) {
            if (row.seed == null) continue
            if (seen.has(row.seed)) clashing.add(row.seed)
            seen.add(row.seed)
        }
        return clashing
    }, [rows])

    return (
        <SectionCard
            title="Seeding"
            subtitle={tierSize
                ? `Seed 1 is the strongest team. Tiers of ${tierSize} are split one per group.`
                : 'Seed 1 is the strongest team. Seeds decide the draw and settle standings ties.'}
            action={
                <div className="flex items-center gap-2">
                    <ActionButton onClick={numberInOrder} disabled={busy}>Number in order</ActionButton>
                    <ActionButton onClick={clearAll} disabled={busy}>Clear</ActionButton>
                    <ActionButton tone="emerald" onClick={() => void save()} loading={busy} disabled={!dirty}>Save seeds</ActionButton>
                </div>
            }
        >
            <ErrorBanner message={error} />

            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teams to seed yet.</p>
            ) : (
                <div className="space-y-1">
                    {rows.map((row, index) => {
                        const tier = tierSize && row.seed ? Math.ceil(row.seed / tierSize) : null

                        return (
                            <div key={row.id} className="flex items-center gap-2 py-1 min-w-0">
                                <input
                                    type="number"
                                    min={1}
                                    value={row.seed ?? ''}
                                    onChange={event => setSeed(row.id, event.target.value ? Number(event.target.value) : null)}
                                    className={cn(
                                        teamInputClass, 'h-8 w-16 py-1 text-xs tabular-nums shrink-0',
                                        row.seed != null && duplicates.has(row.seed) && 'border-red-500/50',
                                    )}
                                />
                                <span className="min-w-0 truncate text-sm text-foreground">{row.name}</span>
                                {tier != null && (
                                    <span className="shrink-0 text-[10px] text-muted-foreground/70">tier {tier}</span>
                                )}
                                <div className="ml-auto flex items-center shrink-0">
                                    <button
                                        type="button"
                                        title="Move up"
                                        onClick={() => move(index, -1)}
                                        disabled={index === 0}
                                        className="p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ArrowUp className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        title="Move down"
                                        onClick={() => move(index, 1)}
                                        disabled={index === rows.length - 1}
                                        className="p-1 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ArrowDown className="size-3.5" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {duplicates.size > 0 && (
                <p className="text-[11px] text-amber-300">
                    Two teams share seed {[...duplicates].join(', ')} — the draw will still run, but the tie order is arbitrary.
                </p>
            )}
        </SectionCard>
    )
}
