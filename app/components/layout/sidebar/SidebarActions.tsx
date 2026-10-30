import type { ElementType } from 'react'
import { Server, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { NavLink } from '@/app/components/navigation/NavLink'
import { Tooltip } from '@/app/components/ui/tooltip'
import { usePlatform } from '@/app/platform'

interface SidebarActionsProps {
    installValid: boolean
    collapsed: boolean
    onJoinServer: () => void
}

const TILE_SHAPE = 'size-12 [@media(max-height:800px)]:size-11 flex-col gap-0.5 px-0 has-[>svg]:px-0'

function ActionContent({ icon: Icon, iconClassName, caption, label, collapsed }: {
    icon: ElementType
    iconClassName?: string
    caption: string
    label: string
    collapsed: boolean
}) {
    if (!collapsed) {
        return (
            <>
                <Icon className={cn('size-4', iconClassName)} />
                <span>{label}</span>
            </>
        )
    }

    return (
        <>
            <Icon className={cn('size-5', iconClassName)} />
            <span className="text-[10px] leading-tight">{caption}</span>
            <span className="sr-only">{label}</span>
        </>
    )
}

export function SidebarActions({ installValid, collapsed, onJoinServer }: SidebarActionsProps) {
    const { capabilities } = usePlatform()
    if (!capabilities.game) return null

    const playContent = <ActionContent icon={Play} iconClassName="fill-current" caption="Play" label="Launch Game" collapsed={collapsed} />

    return (
        <div className={cn(
            'mb-6 [@media(max-height:800px)]:mb-3 relative z-10',
            collapsed ? 'px-2 flex flex-col items-center gap-2' : 'px-4 space-y-2',
        )}>
            <Button
                asChild
                variant="ghost"
                className={cn(
                    'bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition font-semibold rounded-lg',
                    collapsed ? TILE_SHAPE : 'w-full h-11',
                )}
            >
                <NavLink view="servers" onActivate={onJoinServer}>
                    <ActionContent icon={Server} caption="Join" label="Join Server" collapsed={collapsed} />
                </NavLink>
            </Button>
            {installValid ? (
                <Button
                    variant="ghost"
                    className={cn(
                        'bg-card/50 border border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-hairline/20 transition-colors rounded-lg font-medium',
                        collapsed ? TILE_SHAPE : 'w-full h-9',
                    )}
                    onClick={() => window.conveyor.game.launchGameStandalone()}
                >
                    {playContent}
                </Button>
            ) : (
                <Tooltip content="No valid UT99 installation found" side={collapsed ? 'right' : 'top'} className={collapsed ? undefined : 'w-full'}>
                    <Button
                        variant="ghost"
                        disabled
                        className={cn(
                            'bg-card/30 border border-hairline/5 text-muted-foreground/60 cursor-not-allowed transition-colors rounded-lg font-medium',
                            collapsed ? TILE_SHAPE : 'w-full h-9',
                        )}
                    >
                        {playContent}
                    </Button>
                </Tooltip>
            )}
        </div>
    )
}
