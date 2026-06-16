import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu'
import { fuzzyMatch } from '@/app/utils/search'

interface MultiFilterDropdownProps {
    label: string
    options: [string, string][]
    values: string[]
    onChange: (next: string[]) => void
    iconFor?: (value: string) => string | null
    placeholder?: string
    minWidth?: number
    searchable?: boolean
}

export function MultiFilterDropdown({
    label, options, values, onChange, iconFor, placeholder = 'Any', minWidth = 160, searchable,
}: MultiFilterDropdownProps) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    useEffect(() => {
        if (!open) setQuery('')
    }, [open])

    const filteredOptions = !searchable || !query
        ? options
        : options.filter(([value, lbl]) => fuzzyMatch(lbl, query) || fuzzyMatch(value, query))

    const summary = values.length === 0
        ? placeholder
        : values.length === 1
            ? options.find(([v]) => v === values[0])?.[1] ?? values[0]
            : `${values.length} selected`

    return (
        <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <button
                        style={{ minWidth }}
                        className="px-2 py-2 bg-card/50 border border-white/10 rounded text-sm text-white text-left hover:border-white/20 cursor-pointer flex items-center justify-between gap-2"
                    >
                        <span className="truncate">{summary}</span>
                        <ChevronDown className="size-3.5 opacity-60 shrink-0" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-56">
                    {searchable && (
                        <div className="px-1 pb-1 sticky top-0 bg-popover z-10">
                            <input
                                type="text"
                                autoFocus
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.stopPropagation()}
                                placeholder="Search..."
                                className="w-full px-2 py-1.5 bg-card/50 border border-white/10 rounded text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50"
                            />
                        </div>
                    )}
                    <div className="max-h-64 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-muted-foreground">No matches.</div>
                        ) : filteredOptions.map(([value, optLabel]) => {
                            const checked = values.includes(value)
                            const iconSrc = iconFor?.(value) ?? null
                            return (
                                <div
                                    key={value}
                                    onClick={() => {
                                        const next = checked
                                            ? values.filter(x => x !== value)
                                            : [...values, value]
                                        onChange(next)
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer hover:bg-white/5 rounded select-none"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        readOnly
                                        className="accent-[var(--accent-500)] cursor-pointer pointer-events-none"
                                    />
                                    <span className="flex-1 truncate">{optLabel}</span>
                                    {iconSrc && (
                                        <img src={iconSrc} alt="" className="size-4 object-contain shrink-0" />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    {values.length > 0 && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={e => {
                                    e.preventDefault()
                                    onChange([])
                                }}
                                className="text-muted-foreground"
                            >
                                Clear selection ({values.length})
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}
