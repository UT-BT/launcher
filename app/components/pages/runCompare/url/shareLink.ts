import { viewToPath } from '@/app/components/navigation/routes'
import { serializeCompareQuery, type CompareUrlState } from './compareUrl'

const SITE_ORIGIN = (import.meta.env.VITE_SITE_ORIGIN || 'https://utbt.net').replace(/\/$/, '')

export function compareShareLink(state: CompareUrlState, seconds: number | null): string {
    const t = seconds === null ? null : Math.round(seconds * 1000) / 1000
    return SITE_ORIGIN + viewToPath('run-compare', { compare: serializeCompareQuery({ ...state, t }) })
}
