import { checkModal } from '../interactions'
import { measuredRoot, notApplicable, resultOf, type RuleCheck } from './types'

export const modalFits: RuleCheck = async ({ page, surface }) => {
    const root = measuredRoot(surface)
    if (!root) return notApplicable('no modal is open on this surface')
    const check = await checkModal(page, root)
    if (!check.open) return notApplicable(check.problems[0])
    return resultOf(check.problems)
}
