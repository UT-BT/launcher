import { useEffect, useRef, useState } from 'react'
import { Bookmark, BookmarkPlus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu'

export interface FilterPreset<TFilters> {
    id: string
    name: string
    filters: TFilters
}

interface FilterPresetsMenuProps<TFilters> {
    presets: FilterPreset<TFilters>[]
    activePreset: FilterPreset<TFilters> | null
    hasActiveFilters: boolean
    onSave: (name: string, filters: TFilters) => void
    onLoad: (preset: FilterPreset<TFilters>) => void
    onDelete: (preset: FilterPreset<TFilters>) => void
    captureCurrentFilters: () => TFilters
    onResetFilters?: () => void
    label?: string
    placeholderExample?: string
    triggerRef?: React.RefObject<HTMLButtonElement | null>
    menuOpen?: boolean
    onMenuOpenChange?: (open: boolean) => void
}

export function FilterPresetsMenu<TFilters>({
    presets,
    activePreset,
    hasActiveFilters,
    onSave,
    onLoad,
    onDelete,
    captureCurrentFilters,
    onResetFilters,
    label = 'Saved Filters',
    placeholderExample = 'e.g. Easy maps from 2024',
    triggerRef,
    menuOpen: controlledMenuOpen,
    onMenuOpenChange,
}: FilterPresetsMenuProps<TFilters>) {
    const [internalMenuOpen, setInternalMenuOpen] = useState(false)
    const menuOpen = controlledMenuOpen ?? internalMenuOpen
    const setMenuOpen = (next: boolean) => {
        if (onMenuOpenChange) onMenuOpenChange(next)
        if (controlledMenuOpen === undefined) setInternalMenuOpen(next)
    }
    const [saveOpen, setSaveOpen] = useState(false)
    const [nameInput, setNameInput] = useState('')
    const [pendingDelete, setPendingDelete] = useState<FilterPreset<TFilters> | null>(null)
    const nameInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        if (!saveOpen) return
        const id = window.setTimeout(() => nameInputRef.current?.focus(), 50)
        return () => window.clearTimeout(id)
    }, [saveOpen])

    const submitSave = () => {
        const name = nameInput.trim()
        if (!name) return
        onSave(name, captureCurrentFilters())
        setSaveOpen(false)
        setNameInput('')
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
                    <DropdownMenuTrigger asChild>
                        <button
                            ref={triggerRef}
                            type="button"
                            className={cn(
                                'h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2',
                                activePreset
                                    ? 'bg-blue-500/15 border-blue-500/40 text-blue-200 hover:bg-blue-500/25 hover:border-blue-500/60'
                                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200 hover:border-emerald-500/50',
                            )}
                        >
                            <Bookmark className="size-3.5" />
                            {label}
                            {activePreset ? (
                                <span className="text-[11px] font-semibold text-blue-200 max-w-[160px] truncate">
                                    · {activePreset.name}
                                </span>
                            ) : presets.length > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                                    {presets.length}
                                </span>
                            )}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-56 max-w-80">
                        <DropdownMenuLabel>{label}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {presets.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                No saved presets yet.
                            </div>
                        ) : (
                            presets.map(p => (
                                <DropdownMenuItem
                                    key={p.id}
                                    onSelect={() => onLoad(p)}
                                    className="flex items-center gap-2 pr-1"
                                >
                                    <span className="flex-1 truncate">{p.name}</span>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setMenuOpen(false)
                                            setPendingDelete(p)
                                        }}
                                        className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-300 transition-colors cursor-pointer"
                                        aria-label={`Delete preset ${p.name}`}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </DropdownMenuItem>
                            ))
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={e => {
                                e.preventDefault()
                                if (!hasActiveFilters) return
                                setMenuOpen(false)
                                setNameInput('')
                                setSaveOpen(true)
                            }}
                            disabled={!hasActiveFilters}
                            className={cn(
                                'flex items-center gap-2 text-blue-300',
                                !hasActiveFilters && 'opacity-40 cursor-default',
                            )}
                        >
                            <BookmarkPlus className="size-3.5" />
                            Save Current as Preset
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                {onResetFilters && hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onResetFilters}
                        className="h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2 bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/25 hover:text-red-200 hover:border-red-500/50"
                    >
                        <X className="size-3.5" />
                        Clear Filters
                    </button>
                )}
            </div>

            <Modal
                isOpen={saveOpen}
                onClose={() => setSaveOpen(false)}
                title="Save filter preset"
                className="w-[95%] sm:w-[480px] max-w-md"
                offsetSidebar
                footer={
                    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                        <Button variant="ghost" onClick={() => setSaveOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={submitSave} disabled={!nameInput.trim()}>
                            Save preset
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3">
                    <label className="text-sm font-medium text-white">Preset name</label>
                    <input
                        ref={nameInputRef}
                        type="text"
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && nameInput.trim()) {
                                e.preventDefault()
                                submitSave()
                            }
                        }}
                        placeholder={placeholderExample}
                        className="w-full px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
                    />
                    <p className="text-xs text-muted-foreground">
                        Saves current filters and sort. Loadable from the {label} menu.
                    </p>
                </div>
            </Modal>

            <Modal
                isOpen={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                title="Delete preset?"
                className="w-[95%] sm:w-[420px] max-w-md"
                offsetSidebar
                footer={
                    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                        <Button variant="ghost" onClick={() => setPendingDelete(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (pendingDelete) onDelete(pendingDelete)
                                setPendingDelete(null)
                            }}
                        >
                            Delete
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-muted-foreground">
                    Delete preset{' '}
                    <span className="font-semibold text-white">"{pendingDelete?.name}"</span>?
                    This cannot be undone.
                </p>
            </Modal>
        </>
    )
}
