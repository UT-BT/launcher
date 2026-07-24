import { cn } from '@/lib/utils'
import { teamInputClass } from '@/app/components/pages/teams/teamsShared'

export interface SignupFieldsValue {
    timezone: string
    availability: string
}

export interface VolunteerFlags {
    streaming: boolean
    casting: boolean
    admining: boolean
}

export function emptySignupFields(timezone = ''): SignupFieldsValue {
    return { timezone, availability: '' }
}

export function toSignupPayload(value: SignupFieldsValue): { timezone: string | null; availability: string | null } {
    return {
        timezone: value.timezone.trim() || null,
        availability: value.availability.trim() || null,
    }
}

const VOLUNTEER_OPTIONS: { key: keyof VolunteerFlags; label: string }[] = [
    { key: 'streaming', label: 'Streaming' },
    { key: 'casting', label: 'Co-casting' },
    { key: 'admining', label: 'Admining matches' },
]

export function VolunteerCheckboxes({ value, onChange, disabled }: {
    value: VolunteerFlags
    onChange: (next: VolunteerFlags) => void
    disabled?: boolean
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {VOLUNTEER_OPTIONS.map(opt => (
                <button
                    key={opt.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ ...value, [opt.key]: !value[opt.key] })}
                    className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50',
                        value[opt.key]
                            ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                            : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )
}

export function SignupFieldsInputs({ value, onChange, disabled }: {
    value: SignupFieldsValue
    onChange: (updater: (prev: SignupFieldsValue) => SignupFieldsValue) => void
    disabled?: boolean
}) {
    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Timezone</label>
                <input
                    value={value.timezone}
                    disabled={disabled}
                    maxLength={64}
                    onChange={e => onChange(prev => ({ ...prev, timezone: e.target.value }))}
                    placeholder="e.g. Europe/Amsterdam or CET"
                    className={cn(teamInputClass, 'w-full disabled:opacity-50')}
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Availability</label>
                <textarea
                    value={value.availability}
                    disabled={disabled}
                    maxLength={500}
                    rows={3}
                    onChange={e => onChange(prev => ({ ...prev, availability: e.target.value }))}
                    placeholder="When can you usually play? e.g. weekday evenings after 19:00, most weekends"
                    className={cn(teamInputClass, 'w-full resize-y disabled:opacity-50')}
                />
            </div>
        </div>
    )
}
