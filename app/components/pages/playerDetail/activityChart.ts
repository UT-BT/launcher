import type { UserActivityBucket } from '@/app/utils/api'

export type ActivityMode = 'playtime' | 'caps'

export function defaultActivityMode(activity: Pick<UserActivityBucket, 'hours'>[]): ActivityMode {
    if (activity.length === 0) return 'playtime'
    return activity.some(bucket => bucket.hours > 0) ? 'playtime' : 'caps'
}

export function formatHours(value: number): string {
    const hours = Number.isFinite(value) ? Number(value) : 0
    const coarse = hours.toFixed(1)
    if (Math.abs(hours) >= 1) return coarse
    return Number(coarse) === Number(hours.toFixed(2)) ? coarse : hours.toFixed(2)
}
