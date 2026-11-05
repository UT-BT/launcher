import { createLucideIcon, Egg, Flower, Leaf, PartyPopper, Snowflake, Star, Sun, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EntryId } from '../seasons'

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

const Lantern = createLucideIcon('Lantern', [
    ['path', { d: 'M12 1v2.5', key: 'string' }],
    ['rect', { x: '8.5', y: '3.5', width: '7', height: '2', rx: '0.5', key: 'cap' }],
    ['path', { d: 'M8.5 5.5C5 6.5 3 9 3 12s2 5.5 5.5 6.5h7c3.5-1 5.5-3.5 5.5-6.5s-2-5.5-5.5-6.5Z', key: 'body' }],
    ['path', { d: 'M10 5.5c-1.8 2-1.8 11 0 13M14 5.5c1.8 2 1.8 11 0 13', key: 'ribs' }],
    ['rect', { x: '8.5', y: '18.5', width: '7', height: '2', rx: '0.5', key: 'base' }],
    ['path', { d: 'M12 20.5V23', key: 'tassel' }],
])

export function SeasonGlyph({ season, className, ...props }: LucideProps & { season: EntryId }) {
    if (season === 'spring') return <Flower className={cn('animate-spin', className)} {...props} />
    if (season === 'summer') return <Sun className={cn('animate-spin', className)} {...props} />
    if (season === 'autumn') return <Leaf className={cn('seasonal-wobble', className)} {...props} />
    if (season === 'winter') return <Snowflake className={className} {...props} />
    if (season === 'christmas') return <Snowflake className={cn('animate-spin', className)} {...props} />
    if (season === 'christmas-summer') return <Star className={cn('seasonal-spin-slow', className)} {...props} />
    if (season === 'new-year') return <PartyPopper className={cn('seasonal-wobble', className)} {...props} />
    if (season === 'lunar-new-year') return <Lantern className={cn('seasonal-lantern-swing', className)} {...props} />
    if (season === 'easter') return <Egg className={cn('seasonal-wobble', className)} {...props} />
    return <Pumpkin className={cn('seasonal-wobble', className)} {...props} />
}
