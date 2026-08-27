import type { TeamCapRunDemo } from '@/app/utils/api'

export const NO_RUN_DEMO_TITLE = 'No replay available for this run'

export type RunDemoKind = 'team-time' | 'closest' | 'unknown'

export interface RunDemoBadge {
    kind: RunDemoKind
    label: string
    tooltip: string
}

export function runDemoKind(demo: TeamCapRunDemo | null | undefined): RunDemoKind {
    if (!demo) return 'unknown'
    return demo.is_slowest ? 'team-time' : 'closest'
}

export function runDemoIsTeamTime(demo: TeamCapRunDemo | null | undefined): boolean {
    return runDemoKind(demo) === 'team-time'
}

export function runDemoWatchTitle(
    demo: TeamCapRunDemo | null | undefined,
    demoCapId: string | null | undefined,
): string {
    if (!demoCapId) return NO_RUN_DEMO_TITLE
    switch (runDemoKind(demo)) {
        case 'team-time':
            return `Watch the run from ${demo?.alias || 'the slowest member'}, whose time is the team time`
        case 'closest':
            return `The slowest member uploaded no demo — watch ${demo?.alias || 'the closest member'} instead, whose run ends before the team capped`
        default:
            return "Watch this run's replay"
    }
}

export function runDemoBadge(demo: TeamCapRunDemo | null | undefined): RunDemoBadge {
    switch (runDemoKind(demo)) {
        case 'team-time':
            return {
                kind: 'team-time',
                label: 'Run demo',
                tooltip: "This member's time is the team time, so their demo is the run's replay",
            }
        case 'closest':
            return {
                kind: 'closest',
                label: 'Closest demo',
                tooltip: 'The slowest member uploaded no demo, so this is the closest replay — it ends before the team capped',
            }
        default:
            return {
                kind: 'unknown',
                label: 'Run demo',
                tooltip: "This member's demo is the one this run plays",
            }
    }
}
