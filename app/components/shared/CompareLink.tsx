import type { ReactNode } from 'react'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation, type NavParams } from '@/app/components/navigation/NavigationContext'
import { EMPTY_COMPARE_STATE, serializeCompareQuery } from '@/app/components/pages/runCompare/url/compareUrl'

function compareParams(runs: readonly string[]): NavParams {
    return { compare: serializeCompareQuery({ ...EMPTY_COMPARE_STATE, runs: [...runs] }) }
}

function startParams(map: string | null): NavParams {
    return map ? { compare: serializeCompareQuery({ ...EMPTY_COMPARE_STATE, map }) } : {}
}

interface CompareLinkProps {
    runs: readonly string[]
    children: ReactNode
    className?: string
    disabled?: boolean
}

export function CompareLink({ runs, children, className, disabled = false }: CompareLinkProps) {
    const { navigate } = useNavigation()
    const params = compareParams(runs)
    return (
        <NavLink
            view="run-compare"
            params={params}
            onActivate={() => navigate('run-compare', params)}
            className={className}
            disabled={disabled || runs.length === 0}
        >
            {children}
        </NavLink>
    )
}

interface CompareStartLinkProps {
    map?: string | null
    children: ReactNode
    className?: string
}

export function CompareStartLink({ map = null, children, className }: CompareStartLinkProps) {
    const { navigate } = useNavigation()
    const params = startParams(map)
    return (
        <NavLink view="run-compare" params={params} onActivate={() => navigate('run-compare', params)} className={className}>
            {children}
        </NavLink>
    )
}
