import { checkModal, closeModal, rotate, scrollDownThenToTop, topOfPageProblems } from '../interactions'
import { measuredRoot, resultOf, type RuleCheck } from './types'

export const rotationRecovers: RuleCheck = async ({ page, surface }) => {
    const root = measuredRoot(surface)
    if (root && surface.modal && await page.locator(root).count() === 0) await surface.modal.open(page)
    const size = await rotate(page)
    const problems: string[] = []
    const notes: string[] = []
    if (root) {
        const check = await checkModal(page, root)
        problems.push(...check.problems.map(problem => `at ${size}, ${problem}`))
        const closing = await closeModal(page, root)
        notes.push(...closing.notes)
        if (!closing.closed) return { status: 'fail', detail: [...problems, ...notes] }
    }
    await scrollDownThenToTop(page)
    problems.push(...(await topOfPageProblems(page)).map(problem => `at ${size} after scrolling to the top, ${problem}`))
    const result = resultOf(problems)
    return { ...result, detail: [...result.detail, ...notes] }
}
