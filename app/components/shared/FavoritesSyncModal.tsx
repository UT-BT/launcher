import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Check, GitMerge, Monitor, Gamepad2, AlertTriangle } from 'lucide-react'

import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'

export type SyncResolution = 'db-wins' | 'ini-wins' | 'merge'

interface FavoritesSyncModalProps {
    open: boolean
    dbFavorites: string[]
    iniFavorites: string[]
    onResolve: (resolution: SyncResolution) => Promise<void>
    onDismiss: () => void
}

const recommendResolution = (db: Set<string>, ini: Set<string>): SyncResolution => {
    if (ini.size === 0 && db.size > 0) return 'db-wins'
    if (db.size === 0 && ini.size > 0) return 'ini-wins'
    return 'merge'
}

const RESOLUTION_LABELS: Record<SyncResolution, string> = {
    'db-wins': 'Use UTBT.net favorites',
    'ini-wins': 'Use local favorites',
    'merge': 'Merge',
}

const RESOLUTION_DESCRIPTIONS: Record<SyncResolution, string> = {
    'db-wins': 'Overwrite your local changes with the favorites you have on the cloud.',
    'ini-wins': 'Replace your local favorites with the ones from the cloud, and upload them. This will overwrite the cloud favorites.',
    'merge': 'Combine both (union). Both sides end up with every favorite.',
}

export function FavoritesSyncModal({
    open,
    dbFavorites,
    iniFavorites,
    onResolve,
    onDismiss,
}: FavoritesSyncModalProps) {
    const [busy, setBusy] = useState(false)
    const [selected, setSelected] = useState<SyncResolution | null>(null)
    const [onlyDiffs, setOnlyDiffs] = useState(false)

    const dbSet = useMemo(() => new Set(dbFavorites), [dbFavorites])
    const iniSet = useMemo(() => new Set(iniFavorites), [iniFavorites])

    const onlyInDb = useMemo(
        () => dbFavorites.filter((n) => !iniSet.has(n)),
        [dbFavorites, iniSet],
    )
    const onlyInIni = useMemo(
        () => iniFavorites.filter((n) => !dbSet.has(n)),
        [iniFavorites, dbSet],
    )
    const inBoth = useMemo(
        () => dbFavorites.filter((n) => iniSet.has(n)),
        [dbFavorites, iniSet],
    )

    const recommended = useMemo(
        () => recommendResolution(dbSet, iniSet),
        [dbSet, iniSet],
    )

    useEffect(() => {
        if (open) setSelected(recommended)
    }, [open, recommended])

    const handleProceed = async () => {
        if (!selected) return
        setBusy(true)
        try {
            await onResolve(selected)
        } finally {
            setBusy(false)
        }
    }

    const renderColumn = (
        title: string,
        icon: React.ReactNode,
        total: number,
        onlyHere: string[],
        sharedTint: string,
        onlyHereTint: string,
    ) => {
        const visibleCount = onlyDiffs ? onlyHere.length : total
        return (
            <div className="flex flex-col gap-3 min-w-0">
                <div className="flex items-center gap-2 text-foreground/80">
                    {icon}
                    <span className="text-sm font-bold uppercase tracking-wider">{title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                        {onlyDiffs
                            ? `${visibleCount} of ${total}`
                            : `${total} ${total === 1 ? 'map' : 'maps'}`}
                    </span>
                </div>
                <div className="flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {visibleCount === 0 && (
                        <div className="flex items-center justify-between gap-2 px-2 py-1 rounded text-xs font-mono border border-dashed border-hairline/10 text-muted-foreground italic leading-5">
                            <span>{onlyDiffs && total > 0 ? 'No differences' : 'Empty'}</span>
                        </div>
                    )}
                    {onlyHere.map((name) => (
                        <div
                            key={`only-${name}`}
                            className={cn(
                                'flex items-center justify-between gap-2 px-2 py-1 rounded text-xs font-mono border',
                                onlyHereTint,
                            )}
                        >
                            <span className="truncate">{name}</span>
                            <span className="text-[9px] uppercase tracking-wider font-bold shrink-0">only here</span>
                        </div>
                    ))}
                    {!onlyDiffs && inBoth.map((name) => (
                        <div
                            key={`both-${name}`}
                            className={cn(
                                'flex items-center justify-between gap-2 px-2 py-1 rounded text-xs font-mono border',
                                sharedTint,
                            )}
                        >
                            <span className="truncate">{name}</span>
                            <Check className="size-3 shrink-0 text-emerald-400/60" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <Modal
            isOpen={open}
            onClose={onDismiss}
            title="Favorites Mismatch"
            maxWidth="900px"
            leftAction={<AlertTriangle className="size-4 text-amber-400" />}
            footer={
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end items-center gap-2 shrink-0">
                    <Button
                        onClick={handleProceed}
                        disabled={busy || !selected}
                    >
                        {busy ? 'Working…' : 'Proceed'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                    The favorites you have on the cloud and locally don't match.
                    <p className="text-sm text-muted-foreground mt-2">
                        Pick how to resolve.
                    </p>
                </p>

                <div className="flex justify-end">
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={onlyDiffs}
                            onChange={(e) => setOnlyDiffs(e.target.checked)}
                            className="size-3.5 accent-emerald-500 cursor-pointer"
                        />
                        Only show differences
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                    {renderColumn(
                        'Synced to UTBT.net',
                        <Monitor className="size-4 text-blue-400" />,
                        dbFavorites.length,
                        onlyInDb,
                        'bg-hairline/5 border-hairline/10 text-foreground/70',
                        'bg-blue-500/10 border-blue-500/30 text-blue-200',
                    )}
                    <div className="hidden md:flex items-center justify-center pt-8">
                        <ArrowLeftRight className="size-5 text-muted-foreground/40" />
                    </div>
                    {renderColumn(
                        'Locally (ini)',
                        <Gamepad2 className="size-4 text-purple-400" />,
                        iniFavorites.length,
                        onlyInIni,
                        'bg-hairline/5 border-hairline/10 text-foreground/70',
                        'bg-purple-500/10 border-purple-500/30 text-purple-200',
                    )}
                </div>

                <div
                    role="radiogroup"
                    aria-label="Resolution strategy"
                    className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs"
                >
                    {(['db-wins', 'merge', 'ini-wins'] as SyncResolution[]).map((r) => {
                        const isSelected = r === selected
                        const isRecommended = r === recommended
                        return (
                            <button
                                key={r}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                disabled={busy}
                                onClick={() => setSelected(r)}
                                className={cn(
                                    'text-left rounded-lg border p-3 transition-colors cursor-pointer outline-none',
                                    'focus-visible:ring-2 focus-visible:ring-ring/50',
                                    'disabled:cursor-not-allowed disabled:opacity-60',
                                    isSelected
                                        ? 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/40'
                                        : 'border-hairline/10 bg-hairline/[0.02] hover:border-hairline/25 hover:bg-hairline/[0.04]',
                                )}
                            >
                                <div className="flex items-center gap-2 font-bold text-foreground/90">
                                    {r === 'merge' && <GitMerge className="size-3.5" />}
                                    {r === 'db-wins' && <Monitor className="size-3.5" />}
                                    {r === 'ini-wins' && <Gamepad2 className="size-3.5" />}
                                    {RESOLUTION_LABELS[r]}
                                    {isRecommended && (
                                        <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-emerald-300/80">
                                            Recommended
                                        </span>
                                    )}
                                </div>
                                <p className="text-muted-foreground mt-1 leading-relaxed">
                                    {RESOLUTION_DESCRIPTIONS[r]}
                                </p>
                            </button>
                        )
                    })}
                </div>
            </div>
        </Modal>
    )
}
