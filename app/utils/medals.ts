import worldRecordIcon from '@/app/assets/world_record.webp'
import championIcon from '@/app/assets/champion.webp'
import goldIcon from '@/app/assets/gold.webp'
import silverIcon from '@/app/assets/silver.webp'
import bronzeIcon from '@/app/assets/bronze.webp'
import certifiedIcon from '@/app/assets/certified.webp'
import casualIcon from '@/app/assets/casual.webp'

export function getMedalIcon(medal: string | null | undefined): string | null {
    switch (medal?.toLowerCase()) {
        case 'world record': return worldRecordIcon
        case 'champion medal': return championIcon
        case 'gold medal': return goldIcon
        case 'silver medal': return silverIcon
        case 'bronze medal': return bronzeIcon
        case 'certified': return certifiedIcon
        case 'casual': return casualIcon
        default: return null
    }
}
