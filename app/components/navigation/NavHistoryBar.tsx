import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useNavigation } from './NavigationContext'

export function NavHistoryBar() {
    const { back, forward, canBack, canForward } = useNavigation()

    return (
        <div className="flex items-center gap-1 mb-3 -ml-1">
            <Tooltip content="Back" side="bottom">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={back}
                    disabled={!canBack}
                    aria-label="Back"
                    className={cn('size-8 text-muted-foreground hover:text-white', !canBack && 'opacity-30')}
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
                    className={cn('size-8 text-muted-foreground hover:text-white', !canForward && 'opacity-30')}
                >
                    <ArrowRight className="size-4" />
                </Button>
            </Tooltip>
        </div>
    )
}
