import type { PickBanConfig, PickBanStageConfig } from '@/app/utils/api'
import { sameTag } from '../pickBanTags'

export function stagesWithPools(config: PickBanConfig | null): PickBanStageConfig[] {
    if (!config) return []
    return config.stages.filter(stage => stage.pool.length > 0)
}

export type TagBadgeVariant = 'warning' | 'default'

export function tagBadgeVariant(tag: string): TagBadgeVariant {
    return sameTag(tag, 'Hard') ? 'warning' : 'default'
}
