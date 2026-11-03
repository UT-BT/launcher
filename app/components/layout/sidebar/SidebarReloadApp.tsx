import { RefreshCw } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

export function SidebarReloadApp() {
    return (
        <div className="px-4 pt-3 relative z-10">
            <Button
                variant="ghost"
                className="w-full h-11 justify-start gap-3 px-4 bg-card/50 border border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-hairline/20 transition-colors rounded-lg font-medium"
                onClick={() => window.location.reload()}
            >
                <RefreshCw className="size-4" />
                <span>Reload app</span>
            </Button>
        </div>
    )
}
