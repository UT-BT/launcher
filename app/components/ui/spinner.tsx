import { Loader2, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SeasonalSpinnerGlyph } from '@/app/seasonal/lazyDecor'

export function Spinner({ className, ...props }: LucideProps) {
    const plain = <Loader2 className={cn('animate-spin', className)} {...props} />
    return <SeasonalSpinnerGlyph className={className} fallback={plain} {...props} />
}
