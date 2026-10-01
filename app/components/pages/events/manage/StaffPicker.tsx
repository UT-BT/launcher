import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'

const NONE = 'none'

interface StaffPerson {
    id: string
    display_name: string | null
}

interface StaffPickerProps<T extends StaffPerson> {
    kind: string
    noneLabel: string
    current: T | null
    choices: T[]
    emptyNote: string
    saving: boolean
    nameOf: (person: T) => string
    badgeOf?: (person: T) => ReactNode
    onOpen: () => void
    onChange: (userId: string | null) => void
}

export function StaffPicker<T extends StaffPerson>({
    kind, noneLabel, current, choices, emptyNote, saving, nameOf, badgeOf, onOpen, onChange,
}: StaffPickerProps<T>) {
    const selected = current?.id ?? NONE

    return (
        <DropdownMenu onOpenChange={open => { if (open) onOpen() }}>
            <DropdownMenuTrigger asChild disabled={saving}>
                <button
                    type="button"
                    aria-label={`${kind}: ${current ? nameOf(current) : 'none'}`}
                    className="inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-hairline/10 bg-card/50 px-2 text-xs text-foreground hover:border-hairline/20 transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60"
                >
                    {saving ? (
                        <span className="text-muted-foreground">Saving…</span>
                    ) : current ? (
                        <PlayerInfo userId={current.id} alias={nameOf(current)} size="sm" interactive={false} />
                    ) : (
                        <span className="text-muted-foreground">{noneLabel}</span>
                    )}
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                <DropdownMenuRadioGroup
                    value={selected}
                    onValueChange={value => { if (value !== selected) onChange(value === NONE ? null : value) }}
                >
                    <DropdownMenuRadioItem value={NONE}>{noneLabel}</DropdownMenuRadioItem>
                    {choices.length > 0 && <DropdownMenuSeparator />}
                    {choices.map(person => (
                        <DropdownMenuRadioItem key={person.id} value={person.id}>
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                <PlayerInfo userId={person.id} alias={nameOf(person)} size="sm" interactive={false} />
                                {badgeOf?.(person)}
                            </span>
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                {choices.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyNote}</p>}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
