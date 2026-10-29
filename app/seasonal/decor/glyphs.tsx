import { createLucideIcon, Egg, Snowflake, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SeasonId } from '../seasons'

const Pumpkin = createLucideIcon('Pumpkin', [
    [
        'path',
        {
            d: 'M12 7.5c-1.7-1.3-4.5-1.2-6.4.4C3.3 9.8 2.6 13.4 3.8 16.3c1.1 2.7 3.6 4.2 6 3.8.8-.1 1.5-.4 2.2-.8.7.4 1.4.7 2.2.8 2.4.4 4.9-1.1 6-3.8 1.2-2.9.5-6.5-1.8-8.4-1.9-1.6-4.7-1.7-6.4-.4Z',
            key: 'body',
        },
    ],
    ['path', { d: 'M12 7.5c-1.6 3-1.6 9.4 0 12.3', key: 'rib-left' }],
    ['path', { d: 'M12 7.5c1.6 3 1.6 9.4 0 12.3', key: 'rib-right' }],
    ['path', { d: 'M12 7.5V5c0-1 .6-1.7 1.6-2', key: 'stem' }],
])

export function SeasonGlyph({ season, className, ...props }: LucideProps & { season: SeasonId }) {
    if (season === 'christmas') return <Snowflake className={cn('animate-spin', className)} {...props} />
    if (season === 'easter') return <Egg className={cn('seasonal-wobble', className)} {...props} />
    return <Pumpkin className={cn('seasonal-wobble', className)} {...props} />
}
