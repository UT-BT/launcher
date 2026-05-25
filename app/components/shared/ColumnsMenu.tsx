import { useState } from 'react'
import { Columns3, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuLabel, DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu'

interface ColumnsMenuProps<TColumnId extends string> {
    columnOrder: TColumnId[]
    columnVisibility: Record<TColumnId, boolean>
    columnLabels: Record<TColumnId, string>
    onToggle: (id: TColumnId) => void
    onReorder: (sourceId: TColumnId, targetId: TColumnId) => void
    requiredColumns?: ReadonlySet<TColumnId>
    excludeFromList?: ReadonlySet<TColumnId>
    renderExtra?: (id: TColumnId) => React.ReactNode
    triggerRef?: React.RefObject<HTMLButtonElement | null>
    menuOpen?: boolean
    onMenuOpenChange?: (open: boolean) => void
    label?: string
}

export function ColumnsMenu<TColumnId extends string>({
    columnOrder,
    columnVisibility,
    columnLabels,
    onToggle,
    onReorder,
    requiredColumns,
    excludeFromList,
    renderExtra,
    triggerRef,
    menuOpen: controlledOpen,
    onMenuOpenChange,
    label = 'Columns',
}: ColumnsMenuProps<TColumnId>) {
    const [internalOpen, setInternalOpen] = useState(false)
    const isOpen = controlledOpen ?? internalOpen
    const setOpen = (next: boolean) => {
        if (onMenuOpenChange) onMenuOpenChange(next)
        if (controlledOpen === undefined) setInternalOpen(next)
    }

    const [draggingColumn, setDraggingColumn] = useState<TColumnId | null>(null)
    const [dragOverColumn, setDragOverColumn] = useState<TColumnId | null>(null)

    const isRequired = (id: TColumnId) => requiredColumns?.has(id) ?? false
    const isHidden = (id: TColumnId) => excludeFromList?.has(id) ?? false

    return (
        <DropdownMenu open={isOpen} onOpenChange={setOpen} modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    ref={triggerRef}
                    type="button"
                    className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer flex items-center gap-2 bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                >
                    <Columns3 className="size-4" />
                    {label}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-72">
                <DropdownMenuLabel>{label}</DropdownMenuLabel>
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Drag the handle to reorder
                    <br />
                    Checkbox toggles visibility
                </div>
                <DropdownMenuSeparator />
                {columnOrder.filter(id => !isHidden(id)).map(id => {
                    const required = isRequired(id)
                    const dragging = draggingColumn === id
                    const dragOver = dragOverColumn === id && draggingColumn !== id
                    return (
                        <div
                            key={id}
                            draggable
                            onDragStart={e => {
                                setDraggingColumn(id)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', id)
                            }}
                            onDragEnter={e => {
                                e.preventDefault()
                                if (draggingColumn && draggingColumn !== id) setDragOverColumn(id)
                            }}
                            onDragOver={e => {
                                e.preventDefault()
                                e.dataTransfer.dropEffect = 'move'
                            }}
                            onDragLeave={() => {
                                if (dragOverColumn === id) setDragOverColumn(null)
                            }}
                            onDrop={e => {
                                e.preventDefault()
                                if (draggingColumn) onReorder(draggingColumn, id)
                                setDraggingColumn(null)
                                setDragOverColumn(null)
                            }}
                            onDragEnd={() => {
                                setDraggingColumn(null)
                                setDragOverColumn(null)
                            }}
                            className={cn(
                                'flex items-center gap-2 px-2 py-1.5 text-sm select-none rounded transition-colors',
                                dragging && 'opacity-40',
                                dragOver && 'bg-blue-500/15 ring-1 ring-blue-500/40',
                            )}
                        >
                            <input
                                type="checkbox"
                                checked={!!columnVisibility[id]}
                                disabled={required}
                                onChange={() => onToggle(id)}
                                aria-label={`Toggle ${columnLabels[id]} visibility`}
                                className="accent-blue-500 cursor-pointer disabled:cursor-default"
                            />
                            <span className={cn('flex-1 truncate', required && 'text-muted-foreground/80')}>
                                {columnLabels[id]}
                                {required && (
                                    <span className="ml-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">
                                        required
                                    </span>
                                )}
                            </span>
                            {renderExtra?.(id)}
                            <GripVertical
                                className="size-4 text-muted-foreground/60 cursor-grab active:cursor-grabbing"
                                aria-label="Drag to reorder"
                            />
                        </div>
                    )
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
