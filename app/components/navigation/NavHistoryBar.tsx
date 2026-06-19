import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useNavigation } from './NavigationContext'
import { usePageRefresh } from './PageRefreshContext'

export function NavHistoryBar() {
    const { back, forward, canBack, canForward } = useNavigation()
    const refresh = usePageRefresh()
    const r = refresh?.display

    return (
        <div className="flex items-center justify-between gap-1 mb-3 -ml-1">
            <div className="flex items-center gap-1">
                <Tooltip content="Back" side="bottom">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={back}
                        disabled={!canBack}
                        aria-label="Back"
                        className={cn('size-8 text-muted-foreground hover:text-foreground', !canBack && 'opacity-30')}
                    >
                        <ArrowLeft className="size-4" />
                    </Button>
                </Tooltip>
                <Tooltip content="Forward" side="bottom">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={forward}
                        disabled={!canForward}
                        aria-label="Forward"
                        className={cn('size-8 text-muted-foreground hover:text-foreground', !canForward && 'opacity-30')}
                    >
                        <ArrowRight className="size-4" />
                    </Button>
                </Tooltip>
            </div>

            {r?.active && (
                <Tooltip content={r.tooltip ?? 'Refresh'} side="bottom">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => refresh?.trigger()}
                        disabled={r.refreshing || r.disabled}
                        aria-label="Refresh"
                        className="size-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                        <RefreshCw className={cn('size-4', r.refreshing && 'animate-spin')} />
                    </Button>
                </Tooltip>
            )}
        </div>
    )
}
