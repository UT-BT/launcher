import { Server, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { NavLink } from '@/app/components/navigation/NavLink'
import { Tooltip } from '@/app/components/ui/tooltip'
import { usePlatform } from '@/app/platform'

interface SidebarActionsProps {
    installValid: boolean
    onJoinServer: () => void
}

export function SidebarActions({ installValid, onJoinServer }: SidebarActionsProps) {
    const { capabilities } = usePlatform()

    return (
        <div className={cn(
            'px-4 mb-6 [@media(max-height:800px)]:mb-3 relative z-10 space-y-2',
            !capabilities.game && 'max-lg:hidden max-lg:mb-0',
        )}>
            <Button
                asChild
                variant="ghost"
                className="w-full h-11 bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60 hover:shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all font-semibold rounded-lg"
            >
                <NavLink view="servers" onActivate={onJoinServer}>
                    <Server className="size-4" />
                    Join Server
                </NavLink>
            </Button>
            {capabilities.game && (installValid ? (
                <Button
                    variant="ghost"
                    className="w-full h-9 bg-card/50 border border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-hairline/20 transition-colors rounded-lg font-medium"
                    onClick={() => window.conveyor.game.launchGameStandalone()}
                >
                    <Play className="size-4 fill-current" />
                    Launch Game
                </Button>
            ) : (
                <Tooltip content="No valid UT99 installation found" side="top" className="w-full">
                    <Button
                        variant="ghost"
                        disabled
                        className="w-full h-9 bg-card/30 border border-hairline/5 text-muted-foreground/60 cursor-not-allowed rounded-lg font-medium"
                    >
                        <Play className="size-4 fill-current" />
                        Launch Game
                    </Button>
                </Tooltip>
            ))}
        </div>
    )
}
