import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ActiveTitle, TeamMemberStatus, TeamRole } from '@/app/utils/api'

export const teamInputClass =
    'px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50'

export function memberTitle(raw: ActiveTitle | null | undefined): ActiveTitle | null {
    if (!raw || !raw.name) return null
    return raw
}

export function teamErrorMessage(e: unknown): string {
    if (e instanceof Error && e.message) return e.message
    return 'Something went wrong. Please try again.'
}

export function ErrorBanner({ message }: { message: string | null }) {
    if (!message) return null
    return (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
            {message}
        </div>
    )
}

export function SectionCard({ title, subtitle, action, children, className }: {
    title: string
    subtitle?: string
    action?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <section className={cn('bg-card/30 border border-white/10 rounded-xl p-4 space-y-4', className)}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-white">{title}</h2>
                    {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    )
}

const ROLE_STYLES: Record<TeamRole, string> = {
    owner: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    admin: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
    member: 'bg-white/5 text-muted-foreground border-white/10',
}

export function RoleBadge({ role }: { role: TeamRole }) {
    return (
        <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', ROLE_STYLES[role])}>
            {role}
        </span>
    )
}

const STATUS_STYLES: Record<TeamMemberStatus, string> = {
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    invited: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
    applied: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

export function StatusBadge({ status }: { status: TeamMemberStatus }) {
    return (
        <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', STATUS_STYLES[status])}>
            {status}
        </span>
    )
}

export function AccessBadge({ isOpen }: { isOpen: boolean }) {
    return (
        <span className={cn(
            'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border',
            isOpen
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-white/5 text-muted-foreground border-white/10',
        )}>
            {isOpen ? 'Open' : 'Invite Only'}
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
                {isOpen ? 'Anyone can apply to join.' : 'Members can only join by invitation.'}
            </p>
        </div>
    )
}

export function TagChip({ tag, className }: { tag: string | null | undefined; className?: string }) {
    if (!tag) return null
    return (
        <span className={cn(
            'text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-accent-500/15 text-accent-300 border border-accent-500/30',
            className,
        )}>
            {tag}
        </span>
    )
}
