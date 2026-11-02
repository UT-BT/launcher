import type { RuleCheck } from './types'

export function interactive(check: RuleCheck): RuleCheck {
    return async context => {
        try {
            return await check(context)
        } catch (error) {
            const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
            return { status: 'fail', detail: [`the rule could not finish: ${message}`] }
        }
    }
}
