import type { UserSummaryCounts } from '@/app/utils/api'
import type { PlayerDetailTab } from './MainSectionTabs'

export interface PlayerDetailTabItem {
    value: PlayerDetailTab
    label: string
    count?: number
    hidden?: boolean
}

export const DEFAULT_PLAYER_DETAIL_TAB: PlayerDetailTab = 'caps'

export function playerDetailTabs(
    storedTab: PlayerDetailTab,
    counts: UserSummaryCounts | null,
    authoredMapCount: number | null,
): { tabs: PlayerDetailTabItem[]; activeTab: PlayerDetailTab } {
    const tabs: PlayerDetailTabItem[] = [
        { value: 'caps', label: 'All Caps', count: counts?.total_caps },
        { value: 'disallowed', label: 'Disallowed', count: counts?.disallowed_caps, hidden: !counts?.disallowed_caps },
        { value: 'pbs', label: 'Personal Bests', count: counts?.unique_maps },
        { value: 'wrs', label: 'World Records', count: counts?.wr_count },
        { value: 'playtime', label: 'Playtime by Map' },
        { value: 'uncapped', label: 'Uncapped Maps', count: counts?.uncapped_maps },
        { value: 'achievements', label: 'Achievements' },
        { value: 'maps', label: 'Maps Authored', count: authoredMapCount ?? undefined, hidden: !authoredMapCount },
    ]
    const knownEmpty: Partial<Record<PlayerDetailTab, boolean>> = {
        disallowed: counts != null && !counts.disallowed_caps,
        maps: authoredMapCount === 0,
    }
    const activeTab = knownEmpty[storedTab] ? DEFAULT_PLAYER_DETAIL_TAB : storedTab
    return { tabs, activeTab }
}
