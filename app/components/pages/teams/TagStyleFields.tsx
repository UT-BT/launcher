import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { toActiveTitle, type TeamTagPosition, type TeamTagStyle, type UserProfile } from '@/app/utils/api'
import { TAG_STYLES, formatTaggedAlias } from './tagFormat'

const SAMPLE_NUMBER = 1

export interface TagStyleValue {
    tag: string
    position: TeamTagPosition
    style: TeamTagStyle
    spaced: boolean
}

function Segmented<T extends string>({ value, options, onChange }: {
    value: T
    options: { value: T; label: string }[]
    onChange: (value: T) => void
}) {
    return (
        <div className="flex items-center gap-1 flex-wrap">
            {options.map(option => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                        value === option.value
                            ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                            : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}

export function TagStyleFields({ value, onChange }: {
    value: TagStyleValue
    onChange: (next: TagStyleValue) => void
}) {
    const isNumberOnly = value.style === 'number_only'
    const styleHint = TAG_STYLES.find(s => s.id === value.style)?.hint

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tag style</span>
                <Segmented
                    value={value.style}
                    options={TAG_STYLES.map(s => ({ value: s.id, label: s.label }))}
                    onChange={style => onChange({ ...value, style })}
                />
                {styleHint && <span className="text-[11px] text-muted-foreground">{styleHint}</span>}
            </div>

            {!isNumberOnly && (
                <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tag position</span>
                        <Segmented
                            value={value.position}
                            options={[{ value: 'prefix' as const, label: 'Prefix' }, { value: 'suffix' as const, label: 'Suffix' }]}
                            onChange={position => onChange({ ...value, position })}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Spacing</span>
                        <Segmented
                            value={value.spaced ? 'spaced' : 'tight'}
                            options={[{ value: 'spaced', label: 'With space' }, { value: 'tight', label: 'No space' }]}
                            onChange={choice => onChange({ ...value, spaced: choice === 'spaced' })}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * `alias` must be the player's RAW, untagged alias. `userProfile.alias` is NOT that — the API
 * bakes the clan tag into it — so previewing from the profile while already in a team renders
 * the tag twice. Callers pass the raw value explicitly.
 */
export function TagPreview({ value, alias, userProfile, memberNumber }: {
    value: TagStyleValue
    alias: string | null | undefined
    userProfile?: UserProfile
    memberNumber?: number | null
}) {
    const numbered = value.style !== 'plain'
    const previewNumber = numbered ? (memberNumber ?? SAMPLE_NUMBER) : null
    const preview = formatTaggedAlias(alias, value.tag, value.position, value.style, value.spaced, previewNumber)

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Preview</span>
            <div className="px-3 py-2.5 bg-white/5 border border-white/5 rounded-lg">
                <PlayerInfo
                    userId={userProfile?.id ?? undefined}
                    alias={preview}
                    title={toActiveTitle(userProfile?.active_title)}
                    interactive={false}
                />
            </div>
            {numbered && memberNumber == null && (
                <span className="text-[11px] text-muted-foreground">
                    Using {SAMPLE_NUMBER} as an example. Assign each member their own number from Manage Members.
                </span>
            )}
        </div>
    )
}
