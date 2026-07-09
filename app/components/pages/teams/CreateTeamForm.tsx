import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { createTeam, type TeamDetail, type TeamTagPosition, type UserProfile } from '@/app/utils/api'
import { formatTaggedAlias, tagValidationError } from './tagFormat'
import { AccessToggle, ErrorBanner, teamInputClass, teamErrorMessage } from './teamsShared'

interface CreateTeamFormProps {
    accessToken: string
    userProfile?: UserProfile
    onCreated: (team: TeamDetail) => void
    onCancel?: () => void
}

const TAG_POSITIONS: TeamTagPosition[] = ['prefix', 'suffix']

export function CreateTeamForm({ accessToken, userProfile, onCreated, onCancel }: CreateTeamFormProps) {
    const [name, setName] = useState('')
    const [tag, setTag] = useState('')
    const [tagPosition, setTagPosition] = useState<TeamTagPosition>('prefix')
    const [isOpen, setIsOpen] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const preview = formatTaggedAlias(userProfile?.alias, tag, tagPosition)
    const tagError = tag.trim().length > 0 ? tagValidationError(tag.trim()) : null
    const canSubmit = name.trim().length > 0 && tag.trim().length > 0 && !tagError && !submitting

    const submit = async () => {
        if (!canSubmit) return
        setSubmitting(true)
        setError(null)
        try {
            const team = await createTeam(accessToken, {
                name: name.trim(),
                tag: tag.trim(),
                tag_position: tagPosition,
                is_open: isOpen,
            })
            onCreated(team)
        } catch (e) {
            setError(teamErrorMessage(e))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Team name</span>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        maxLength={40}
                        placeholder="e.g. Bunny Brigade"
                        className={teamInputClass}
                    />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Clan tag</span>
                    <input
                        value={tag}
                        onChange={e => setTag(e.target.value)}
                        maxLength={8}
                        placeholder="e.g. BB"
                        className={teamInputClass}
                    />
                    {tagError && <span className="text-[11px] text-red-400">{tagError}</span>}
                </label>
            </div>

            <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tag position</span>
                    <div className="flex items-center gap-1">
                        {TAG_POSITIONS.map(pos => (
                            <button
                                key={pos}
                                type="button"
                                onClick={() => setTagPosition(pos)}
                                className={cn(
                                    'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer capitalize',
                                    tagPosition === pos
                                        ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                                        : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                                )}
                            >
                                {pos}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Access</span>
                    <AccessToggle isOpen={isOpen} onChange={setIsOpen} />
                </div>
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Preview</span>
                <div className="px-3 py-2 bg-white/5 border border-white/5 rounded-lg text-sm text-white font-medium">
                    {preview}
                </div>
            </div>

            <ErrorBanner message={error} />

            <div className="flex justify-end gap-2">
                {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
                <Button onClick={submit} disabled={!canSubmit}>
                    {submitting ? 'Creating…' : 'Create Team'}
                </Button>
            </div>
        </div>
    )
}
