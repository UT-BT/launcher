import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { teamInputClass } from '@/app/components/pages/teams/teamsShared'

const QUARTER_HOURS = Array.from({ length: 96 }, (_, index) => {
    const hour = String(Math.floor(index / 4)).padStart(2, '0')
    const minute = String((index % 4) * 15).padStart(2, '0')
    return `${hour}:${minute}`
})

const DEFAULT_TIME = '00:00'

interface DateTimeFieldProps {
    value: string
    onChange: (value: string) => void
    timezone: string
    disabled?: boolean
    clearable?: boolean
    className?: string
}

export function DateTimeField({ value, onChange, timezone, disabled, clearable = true, className }: DateTimeFieldProps) {
    const [date = '', time = ''] = value ? value.split('T') : []
    const timeOptions = time && !QUARTER_HOURS.includes(time) ? [...QUARTER_HOURS, time].sort() : QUARTER_HOURS

    return (
        <div className={cn('space-y-1', className)}>
            <div className="flex items-center gap-1.5">
                <input
                    type="date"
                    value={date}
                    disabled={disabled}
                    onChange={event => onChange(event.target.value ? `${event.target.value}T${time || DEFAULT_TIME}` : '')}
                    style={{ colorScheme: 'dark' }}
                    className={cn(teamInputClass, 'min-w-0 flex-1 h-8 py-1 text-xs disabled:opacity-50')}
                />
                <select
                    value={time}
                    disabled={disabled || !date}
                    onChange={event => onChange(`${date}T${event.target.value}`)}
                    style={{ colorScheme: 'dark' }}
                    className={cn(teamInputClass, 'w-[5.5rem] shrink-0 h-8 py-1 text-xs tabular-nums disabled:opacity-50')}
                >
                    {!date && <option value="">--:--</option>}
                    {timeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                {clearable && value && !disabled && (
                    <button
                        type="button"
                        aria-label="Clear"
                        onClick={() => onChange('')}
                        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground cursor-pointer"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground/70">{timezone}</p>
        </div>
    )
}
