import worldRecordIcon from '@/app/assets/world_record.png'
import championIcon from '@/app/assets/champion.png'
import goldIcon from '@/app/assets/gold.png'
import silverIcon from '@/app/assets/silver.png'
import bronzeIcon from '@/app/assets/bronze.png'
import certifiedIcon from '@/app/assets/certified.png'
import casualIcon from '@/app/assets/casual.png'

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
