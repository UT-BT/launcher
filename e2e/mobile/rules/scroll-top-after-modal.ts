import { closeModal, scrollDownThenToTop, stuckPageProblems, topOfPageProblems } from '../interactions'
import { measuredRoot, notApplicable, resultOf, type RuleCheck } from './types'

export const scrollTopAfterModal: RuleCheck = async ({ page, surface }) => {
    const root = measuredRoot(surface)
    if (!root) return notApplicable('no modal is open on this surface')
    const { closed, notes } = await closeModal(page, root)
    if (!closed) return { status: 'fail', detail: notes }
    const swiped = await scrollDownThenToTop(page)
    const stuck = swiped.length ? [] : await stuckPageProblems(page)
    const result = resultOf([...stuck, ...await topOfPageProblems(page)])
    return { ...result, detail: [...result.detail, ...notes] }
}
