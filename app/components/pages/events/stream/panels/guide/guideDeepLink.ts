import { guideStepIds } from './guideSteps'

const HASH_PREFIX = 'guide-'

export function guideStepHash(stepId: string): string {
    return `#${HASH_PREFIX}${stepId}`
}

export function guideStepFromHash(hash: string): string | null {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash
    if (!raw.startsWith(HASH_PREFIX)) return null
    const id = raw.slice(HASH_PREFIX.length)
    return guideStepIds().includes(id) ? id : null
}

export function toggleStep(open: string[], stepId: string): string[] {
    return open.includes(stepId) ? open.filter(id => id !== stepId) : [...open, stepId]
}

export function withStepOpen(open: string[], stepId: string): string[] {
    return open.includes(stepId) ? open : [...open, stepId]
}
