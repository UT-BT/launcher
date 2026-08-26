import type { RouteTarget } from '@/app/components/navigation/routes'

export function capTimeTarget(
    capId?: string | null,
    teamCapId?: string | null,
): RouteTarget | null {
    if (teamCapId) return { view: 'team-cap-detail', params: { teamCapId } }
    if (capId) return { view: 'cap-detail', params: { capId } }
    return null
}
