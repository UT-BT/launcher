import type { ElementType, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react'
import { IS_WEB } from '@/app/platform/target'
import type { NavParams } from './NavigationContext'
import { viewToPath } from './routes'

export function isBrowserHandledClick(e: MouseEvent): boolean {
    return IS_WEB && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0)
}

interface NavLinkProps {
    view: string
    params?: NavParams
    onActivate: () => void
    children: ReactNode
    as?: ElementType
    className?: string
    disabled?: boolean
    stopPropagation?: boolean
    ariaLabel?: string
    title?: string
    tabIndex?: number
    elementRef?: Ref<HTMLElement>
    onPointerEnter?: () => void
    onFocus?: () => void
}

export function NavLink({
    view,
    params,
    onActivate,
    children,
    as = 'button',
    className,
    disabled = false,
    stopPropagation = true,
    ariaLabel,
    title,
    tabIndex,
    elementRef,
    onPointerEnter,
    onFocus,
}: NavLinkProps) {
    const handleClick = (e: MouseEvent) => {
        if (stopPropagation) e.stopPropagation()
        if (isBrowserHandledClick(e)) return
        e.preventDefault()
        onActivate()
    }

    const shared = {
        className,
        title,
        onPointerEnter,
        onFocus,
        'aria-label': ariaLabel,
    }

    if (disabled) {
        const Inert = as === 'button' ? 'span' : as
        return (
            <Inert ref={elementRef} {...shared}>
                {children}
            </Inert>
        )
    }

    if (IS_WEB) {
        return (
            <a
                href={viewToPath(view, params ?? {})}
                onClick={handleClick}
                tabIndex={tabIndex}
                ref={elementRef as Ref<HTMLAnchorElement>}
                {...shared}
            >
                {children}
            </a>
        )
    }

    const Element = as
    if (Element === 'button') {
        return (
            <button
                type="button"
                onClick={handleClick}
                tabIndex={tabIndex}
                ref={elementRef as Ref<HTMLButtonElement>}
                {...shared}
            >
                {children}
            </button>
        )
    }

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        if (stopPropagation) e.stopPropagation()
        onActivate()
    }

    return (
        <Element
            role="button"
            tabIndex={tabIndex ?? 0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            ref={elementRef}
            {...shared}
        >
            {children}
        </Element>
    )
}
