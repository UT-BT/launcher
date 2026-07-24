import { useEffect } from 'react'
import { IS_WEB } from '@/app/platform'
import { viewToPath } from './routes'
import { titleForRoute } from './titles'
import type { NavParams } from './NavigationContext'

function setCanonical(href: string): void {
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
        link = document.createElement('link')
        link.rel = 'canonical'
        document.head.appendChild(link)
    }
    link.href = href
}

/**
 * Keeps the tab title and canonical link in step with client-side navigation.
 *
 * The initial document already carries the correct head; this covers every
 * navigation after it. Deliberately does not touch `og:*` — crawlers never run
 * JS, so updating those client-side costs bytes and buys nothing.
 */
export function useDocumentMeta(view: string, params: NavParams): void {
    const path = viewToPath(view, params)
    useEffect(() => {
        if (!IS_WEB) return
        document.title = titleForRoute(view, params)
        setCanonical(window.location.origin + path)
    }, [view, params, path])
}

/**
 * Refines the tab title once a detail page knows what it is showing.
 *
 * A fresh navigation shows `useDocumentMeta`'s generic title first; this
 * replaces it when the page's data arrives (the detail pages fetch async, so
 * `name` is undefined on the first commit and this no-ops until then). Pass
 * `undefined` while loading to leave the generic title in place.
 */
export function useDocumentTitle(name: string | undefined | null, suffix?: string): void {
    useEffect(() => {
        if (!IS_WEB || !name) return
        document.title = suffix ? `${name} — ${suffix}` : name
    }, [name, suffix])
}
