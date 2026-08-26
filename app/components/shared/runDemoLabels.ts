import type { TeamCapRunDemo } from '@/app/utils/api'

export const NO_RUN_DEMO_TITLE = 'No replay available for this run'

export interface RunDemoBadge {
    label: string
    tooltip: string
    isTeamTime: boolean
}

export function runDemoIsTeamTime(demo: TeamCapRunDemo | null | undefined): boolean {
    return demo?.is_slowest ?? false
}

export function runDemoWatchTitle(
    demo: TeamCapRunDemo | null | undefined,
    demoCapId: string | null | undefined,
): string {
    if (!demoCapId) return NO_RUN_DEMO_TITLE
    if (runDemoIsTeamTime(demo)) {
        return `Watch the run from ${demo?.alias || 'the slowest member'}, whose time is the team time`
    }
    return `The slowest member uploaded no demo — watch ${demo?.alias || 'the closest member'} instead, whose run ends before the team capped`
}

export function runDemoBadge(demo: TeamCapRunDemo | null | undefined): RunDemoBadge {
    if (runDemoIsTeamTime(demo)) {
        return {
            isTeamTime: true,
            label: 'Run demo',
            tooltip: "This member's time is the team time, so their demo is the run's replay",
        }
    }
    return {
        isTeamTime: false,
        label: 'Closest demo',
        tooltip: 'The slowest member uploaded no demo, so this is the closest replay — it ends before the team capped',
    }
}
