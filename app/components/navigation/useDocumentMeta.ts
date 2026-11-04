import { useEffect } from 'react'
import { IS_WEB } from '@/app/platform'
import { canonicalPath } from './routes'
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
export function useDocumentMeta(view: string, params: NavParams, entryId: number): void {
    const title = titleForRoute(view, params)
    const path = canonicalPath(view, params)
    useEffect(() => {
        if (!IS_WEB) return
        document.title = title
    }, [view, title, entryId])
    useEffect(() => {
        if (!IS_WEB) return
        setCanonical(window.location.origin + path)
    }, [path, entryId])
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
