import type { ReactNode, Ref } from 'react'
import { NavLink } from '@/app/components/navigation/NavLink'

interface MapNavLinkProps {
    mapName: string
    onMapSelect?: (mapName: string) => void
    className?: string
    ariaLabel?: string
    title?: string
    elementRef?: Ref<HTMLElement>
    children: ReactNode
}

export function MapNavLink({ mapName, onMapSelect, className, ariaLabel, title, elementRef, children }: MapNavLinkProps) {
    return (
        <NavLink
            view="maps-detail"
            params={{ mapName }}
            onActivate={() => onMapSelect?.(mapName)}
            disabled={!onMapSelect}
            className={className}
            ariaLabel={ariaLabel}
            title={title}
            elementRef={elementRef}
        >
            {children}
        </NavLink>
    )
}
