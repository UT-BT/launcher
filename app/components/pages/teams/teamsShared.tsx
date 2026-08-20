import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ActiveTitle, TeamMemberStatus } from '@/app/utils/api'

export const teamInputClass =
    'px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50'

export function memberTitle(raw: ActiveTitle | null | undefined): ActiveTitle | null {
    if (!raw || !raw.name) return null
    return raw
}

export function refreshUserProfile() {
    window.dispatchEvent(new CustomEvent('refresh-user-profile'))
}

export function teamErrorMessage(e: unknown): string {
    if (e instanceof Error && e.message) return e.message
    return 'Something went wrong. Please try again.'
}

// Mirrors the API's avatar limits so a bad pick fails instantly instead of after a 4 MB upload.
export const TEAM_AVATAR_MAX_BYTES = 4 * 1024 * 1024
export const TEAM_AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

export function teamAvatarValidationError(file: File): string | null {
    if (!file.type.startsWith('image/')) return 'Choose a PNG, JPEG, WEBP or GIF image.'
    if (file.size > TEAM_AVATAR_MAX_BYTES) return 'Image must be 4 MB or smaller.'
    return null
}

// A data URL, not createObjectURL: the renderer CSP allows `data:` in img-src but not `blob:`.
export function readImageDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Could not read that image.'))
        reader.readAsDataURL(file)
    })
}

export function ErrorBanner({ message }: { message: string | null }) {
    if (!message) return null
    return (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {message}
        </div>
    )
}

export function SectionCard({ title, subtitle, action, children, className, accentClass = 'bg-accent-400' }: {
    title: string
    subtitle?: string
    action?: ReactNode
    children: ReactNode
    className?: string
    accentClass?: string
}) {
    return (
        <section className={cn('bg-card/30 border border-hairline/5 rounded-xl p-4 space-y-4', className)}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                    <span className={cn('h-4 w-1 rounded-full shrink-0', accentClass)} />
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-foreground leading-tight">{title}</h2>
                        {subtitle && <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{subtitle}</p>}
                    </div>
                </div>
                {action}
            </div>
            {children}
        </section>
    )
}

export function SectionHeader({ title, subtitle, action, accentClass = 'bg-accent-400', className }: {
    title: string
    subtitle?: string
    action?: ReactNode
    accentClass?: string
    className?: string
}) {
    return (
        <div className={cn('flex items-center justify-between gap-3 mb-3', className)}>
            <div className="min-w-0 flex items-center gap-2.5">
                <span className={cn('h-4 w-1 rounded-full shrink-0', accentClass)} />
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground leading-tight">{title}</h2>
                    {subtitle && <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
    )
}

const STATUS_STYLES: Record<TeamMemberStatus, string> = {
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    invited: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
    blocked: 'bg-red-500/15 text-red-300 border-red-500/30',
}

export function StatusBadge({ status }: { status: TeamMemberStatus }) {
    return (
        <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', STATUS_STYLES[status])}>
            {status}
        </span>
    )
}

/** `compact` drops the badge to one word — the team cards have no room for two. */
export function AccessBadge({ isOpen, compact }: { isOpen: boolean; compact?: boolean }) {
    return (
        <span className={cn(
            'shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border',
            isOpen
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-white/5 text-muted-foreground border-white/10',
        )}>
            {isOpen ? 'Open' : compact ? 'Invite' : 'Invite Only'}
        </span>
    )
}

export function AccessToggle({ isOpen, onChange }: { isOpen: boolean; onChange: (value: boolean) => void }) {
    const options: { value: boolean; label: string }[] = [
        { value: true, label: 'Open' },
        { value: false, label: 'Invite Only' },
    ]
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1">
                {options.map(opt => (
                    <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        className={cn(
                            'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                            isOpen === opt.value
                                ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                                : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
                {isOpen ? 'Anyone can join instantly.' : 'Members can only join by invitation.'}
            </p>
        </div>
    )
}

export function TagChip({ tag, className }: { tag: string | null | undefined; className?: string }) {
    if (!tag) return null
    return (
        <span className={cn(
            'shrink-0 whitespace-nowrap text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-accent-500/15 text-accent-300 border border-accent-500/30',
            className,
        )}>
            {tag}
        </span>
    )
}
