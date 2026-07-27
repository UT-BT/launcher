import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface SettingsSectionProps {
    title?: string
    description?: string
    icon?: LucideIcon
    children: ReactNode
    className?: string
    action?: ReactNode
}

export function SettingsSection({ title, description, icon: Icon, children, className, action }: SettingsSectionProps) {
    return (
        <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
            {(title || action) && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/30 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                        {Icon && (
                            <div className="flex items-center justify-center rounded-lg bg-primary/10 p-2 text-primary">
                                <Icon className="size-5" />
                            </div>
                        )}
                        <div>
                            {title && <h3 className="font-semibold text-foreground">{title}</h3>}
                            {description && <p className="text-xs text-muted-foreground">{description}</p>}
                        </div>
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className="divide-y divide-border/50 bg-card/50">
                {children}
            </div>
        </div>
    )
}

interface SettingsRowProps {
    label: ReactNode
    description?: ReactNode
    children?: ReactNode
    icon?: LucideIcon
    className?: string
}

export function SettingsRow({ label, description, children, icon: Icon, className }: SettingsRowProps) {
    return (
        <div className={cn("flex flex-col items-stretch gap-3 p-4 hover:bg-muted/20 transition-colors @md/panel:flex-row @md/panel:items-center @md/panel:justify-between @md/panel:gap-4 @md/panel:px-6", className)}>
            <div className="flex items-start gap-4 flex-1 min-w-0">
                {Icon && <Icon className="size-5 text-muted-foreground mt-0.5 shrink-0" />}
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{label}</div>
                    {description && <span className="text-xs text-muted-foreground leading-relaxed max-w-prose">{description}</span>}
                </div>
            </div>
            <div className="flex items-center justify-start @md/panel:justify-end @md/panel:min-w-[200px]">
                {children}
            </div>
        </div>
    )
}
