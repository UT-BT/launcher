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
        <div className="max-lg:hidden px-4 py-2 relative z-10">
            <Tooltip content={`${name} (Ctrl+B)`} side={collapsed ? 'right' : 'top'} className="w-full">
                <button
                    type="button"
                    aria-label={name}
                    aria-expanded={!collapsed}
                    aria-controls="app-navigation"
                    onClick={onToggle}
                    className="w-full h-10 flex items-center gap-4 px-3.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-hairline/5 transition-colors cursor-pointer"
                >
                    <Icon className="size-5 shrink-0" />
                    {!collapsed && <span className="text-sm font-medium">Collapse</span>}
                </button>
            </Tooltip>
        </div>
    )
}
