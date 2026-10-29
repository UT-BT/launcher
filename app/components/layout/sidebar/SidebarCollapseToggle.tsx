import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Tooltip } from '@/app/components/ui/tooltip'

interface SidebarCollapseToggleProps {
    collapsed: boolean
    onToggle: () => void
}

export function SidebarCollapseToggle({ collapsed, onToggle }: SidebarCollapseToggleProps) {
    const Icon = collapsed ? PanelLeftOpen : PanelLeftClose
    const name = collapsed ? 'Expand sidebar' : 'Collapse sidebar'

    return (
        <Tooltip content={`${name} (Ctrl+B)`} side="right" className="max-lg:hidden">
            <button
                type="button"
                aria-label={name}
                aria-expanded={!collapsed}
                aria-controls="app-navigation"
                onClick={onToggle}
                className="size-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-hairline/10 transition-colors cursor-pointer"
            >
                <Icon className="size-5" />
            </button>
        </Tooltip>
    )
}
