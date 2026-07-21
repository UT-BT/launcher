import { useRef, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { createTeam, uploadTeamAvatar, type TeamDetail, type UserProfile } from '@/app/utils/api'
import { nameValidationError, tagValidationError, TEAM_NAME_MAX_LENGTH, TAG_MAX_LENGTH } from './tagFormat'
import { TagPreview, TagStyleFields, type TagStyleValue } from './TagStyleFields'
import {
    AccessToggle, ErrorBanner, TEAM_AVATAR_ACCEPT, readImageDataUrl, teamAvatarValidationError,
    teamInputClass, teamErrorMessage,
} from './teamsShared'

interface CreateTeamFormProps {
    accessToken: string
    userProfile?: UserProfile
    onCreated: (team: TeamDetail) => void
    onCancel?: () => void
}

export function CreateTeamForm({ accessToken, userProfile, onCreated, onCancel }: CreateTeamFormProps) {
    const [name, setName] = useState('')
    const [tagStyle, setTagStyle] = useState<TagStyleValue>({ tag: '', position: 'prefix', style: 'plain', spaced: true })
    const [isOpen, setIsOpen] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
    // The avatar endpoint needs a team id, so the image is uploaded straight after creation.
    // If that second call fails the team still exists — hold it here so retrying never re-creates it.
    const [createdTeam, setCreatedTeam] = useState<TeamDetail | null>(null)
    const avatarInputRef = useRef<HTMLInputElement>(null)

    const tag = tagStyle.tag
    const tagError = tag.trim().length > 0 ? tagValidationError(tag.trim()) : null
    const nameError = name.trim().length > 0 ? nameValidationError(name) : null
    const canSubmit = name.trim().length > 0 && tag.trim().length > 0 && !tagError && !nameError && !submitting

    const pickAvatar = async (file: File | null) => {
        if (!file) return
        const invalid = teamAvatarValidationError(file)
        if (invalid) {
            setError(invalid)
            return
        }
        setError(null)
        setAvatarFile(file)
        try {
            setAvatarPreview(await readImageDataUrl(file))
        } catch {
            setAvatarPreview(null)
        }
    }

    const clearAvatar = () => {
        setAvatarFile(null)
        setAvatarPreview(null)
    }

    const submit = async () => {
        if (!canSubmit && !createdTeam) return
        setSubmitting(true)
        setError(null)
        try {
            const team = createdTeam ?? await createTeam(accessToken, {
                name: name.trim(),
                tag: tag.trim(),
                tag_position: tagStyle.position,
                tag_style: tagStyle.style,
                tag_spaced: tagStyle.spaced,
                is_open: isOpen,
            })
            setCreatedTeam(team)

            if (!avatarFile) {
                onCreated(team)
                return
            }

            try {
                onCreated(await uploadTeamAvatar(accessToken, team.id, avatarFile, avatarFile.name))
            } catch (e) {
                setError(`${team.name} was created, but the image failed to upload: ${teamErrorMessage(e)}`)
            }
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
                        maxLength={TEAM_NAME_MAX_LENGTH}
                        placeholder="e.g. Bunny Brigade"
                        className={teamInputClass}
                    />
                    {nameError && <span className="text-[11px] text-red-400">{nameError}</span>}
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Clan tag</span>
                    <input
                        value={tag}
                        onChange={e => setTagStyle({ ...tagStyle, tag: e.target.value })}
                        maxLength={TAG_MAX_LENGTH}
                        placeholder="e.g. BB"
                        className={teamInputClass}
                    />
                    {tagError && <span className="text-[11px] text-red-400">{tagError}</span>}
                </label>
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Team image</span>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className={cn(
                            'size-16 rounded-xl border border-dashed border-white/15 bg-card/30 overflow-hidden shrink-0',
                            'flex items-center justify-center cursor-pointer transition-colors',
                            'hover:border-accent-500/40 hover:bg-card/50',
                        )}
                    >
                        {avatarPreview ? (
                            <img src={avatarPreview} alt="Team image preview" className="w-full h-full object-cover" />
                        ) : (
                            <ImagePlus className="size-5 text-muted-foreground/50" />
                        )}
                    </button>
                    <div className="min-w-0 space-y-1">
                        <p className="text-[11px] text-muted-foreground">
                            Optional. Square, cropped to 256×256. PNG, JPEG, WEBP or GIF up to 4 MB.
                        </p>
                        {avatarFile && (
                            <button
                                type="button"
                                onClick={clearAvatar}
                                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-white cursor-pointer"
                            >
                                <X className="size-3" /> Remove
                            </button>
                        )}
                    </div>
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept={TEAM_AVATAR_ACCEPT}
                        className="hidden"
                        onChange={e => {
                            void pickAvatar(e.target.files?.[0] ?? null)
                            e.target.value = ''
                        }}
                    />
                </div>
            </div>

            <TagStyleFields value={tagStyle} onChange={setTagStyle} />

            <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Access</span>
                <AccessToggle isOpen={isOpen} onChange={setIsOpen} />
            </div>

            {/* The creator has no team yet, so their profile alias is untagged — safe to preview from. */}
            <TagPreview value={tagStyle} alias={userProfile?.alias} userProfile={userProfile} />

            <ErrorBanner message={error} />

            <div className="flex justify-end gap-2">
                {createdTeam ? (
                    <>
                        <Button variant="secondary" onClick={() => onCreated(createdTeam)}>Continue without image</Button>
                        <Button onClick={submit} disabled={submitting}>
                            {submitting ? 'Uploading…' : 'Retry upload'}
                        </Button>
                    </>
                ) : (
                    <>
                        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
                        <Button onClick={submit} disabled={!canSubmit}>
                            {submitting ? 'Creating…' : 'Create Team'}
                        </Button>
                    </>
                )}
            </div>
        </div>
    )
}
