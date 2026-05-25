import { ChevronRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface SectionHeaderProps {
    title: string
    actionLabel?: string
    onAction?: () => void
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
    return (
        <div className="flex items-center justify-between px-1 h-8">
            <h2 className="text-lg font-black uppercase tracking-widest text-white/80 leading-none">{title}</h2>
            {actionLabel && onAction && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onAction}
                    className="h-7 text-[10px] font-bold text-muted-foreground hover:text-white uppercase tracking-widest gap-2 bg-white/5 border border-white/5"
                >
                    {actionLabel} <ChevronRight className="size-3" />
                </Button>
            )}
        </div>
    )
}
