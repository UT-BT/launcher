import { ApiError, type PickBanErrorCode, type PickBanVetoErrorCode } from '@/app/utils/api'
import { unwordedRejection } from './captainPlay'

type VetoRefusalCode = PickBanErrorCode | PickBanVetoErrorCode

function vetoRejectionsOf(tag: string): Partial<Record<VetoRefusalCode, string>> {
    return {
        veto_not_open: `The ${tag}-map choice is closed: it has already been decided.`,
        already_chosen: `Your team has already made its ${tag}-map choice.`,
        paused: 'The session is paused. Choose once an admin resumes it.',
        version_conflict: 'The session changed at the same moment. Try again.',
        not_authorized: `Only an eligible team’s captain can make the ${tag}-map choice.`,
        wrong_status: 'The Picks & Bans aren’t running any more.',
        no_session: 'This match has no Picks & Bans session any more.',
    }
}

export function vetoRejection(error: unknown, tag: string): string {
    const reason = error instanceof ApiError ? error.reason as VetoRefusalCode | undefined : undefined
    return (reason && vetoRejectionsOf(tag)[reason]) ?? unwordedRejection(error)
}
