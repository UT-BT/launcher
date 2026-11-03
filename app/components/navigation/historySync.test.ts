import { describe, expect, it } from 'vitest'
import { createHistorySync, type BlockedHistoryMove, type HistoryPort } from './historySync'

interface Overlay {
    readonly open: boolean
    unmount: () => void
    closeFromUi: () => void
}

function browserTab() {
    const entries: { state: unknown; url: string }[] = [{ state: null, url: '/' }]
    let index = 0
    const queue: (() => void)[] = []
    const history: HistoryPort = {
        get state() { return entries[index].state },
        pushState(state, _unused, url) {
            entries.splice(index + 1, entries.length, { state, url: url ?? entries[index].url })
            index += 1
        },
        replaceState(state, _unused, url) {
            entries[index] = { state, url: url ?? entries[index].url }
        },
        go(delta) { queue.push(() => traverse(delta)) },
    }
    const sync = createHistorySync(history, task => { queue.push(task) })

    function traverse(delta: number) {
        const next = index + delta
        if (delta === 0 || next < 0 || next >= entries.length) return
        index = next
        sync.onPopState(entries[index].state)
    }

    function settle() {
        for (let step = 0; queue.length > 0; step++) {
            if (step > 100) throw new Error('history never settles')
            queue.shift()!()
        }
    }

    function mount(): Overlay {
        let open = true
        const release = sync.register(() => {
            open = false
            queue.push(release)
        })
        return {
            get open() { return open },
            unmount() {
                open = false
                release()
            },
            closeFromUi() {
                open = false
                release()
                settle()
            },
        }
    }

    const urls = new Map<number, string>([[0, '/']])
    let active = 0
    let nextId = 1
    let unsaved: string | null = null
    const blocked: BlockedHistoryMove[] = []

    sync.attach({
        activeId: () => active,
        leaveWarning: () => unsaved,
        onBlocked: move => { blocked.push(move) },
        show: navId => {
            if (navId !== undefined && urls.has(navId)) {
                active = navId
                return
            }
            active = nextId++
            urls.set(active, entries[index].url)
        },
    }, '/')

    function push(url: string) {
        active = nextId++
        urls.set(active, url)
        sync.pushPage(active, url)
    }

    return {
        get page() { return urls.get(active) },
        get url() { return entries[index].url },
        get length() { return entries.length },
        blocked,
        setUnsaved(message: string | null) { unsaved = message },
        push,
        navigate(url: string, ...unmounted: Overlay[]) {
            push(url)
            for (const overlay of unmounted) overlay.unmount()
            sync.settle()
            settle()
        },
        open(): Overlay {
            const overlay = mount()
            settle()
            return overlay
        },
        swap(outgoing: Overlay): Overlay {
            outgoing.unmount()
            const overlay = mount()
            settle()
            return overlay
        },
        sync,
        mount,
        back() { traverse(-1); settle() },
        forward() { traverse(1); settle() },
        step() { queue.shift()?.() },
        settle,
    }
}

describe('overlay history', () => {
    it('Back closes an open overlay and keeps the page; the next Back leaves the page', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        const modal = tab.open()

        tab.back()
        expect(modal.open).toBe(false)
        expect(tab.page).toBe('/maps')
        expect(tab.url).toBe('/maps')

        tab.back()
        expect(tab.page).toBe('/')
        expect(tab.url).toBe('/')
    })

    it('stacked overlays close one per Back, top-most first', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        const lower = tab.open()
        const upper = tab.open()

        tab.back()
        expect(upper.open).toBe(false)
        expect(lower.open).toBe(true)

        tab.back()
        expect(lower.open).toBe(false)
        expect(tab.page).toBe('/maps')

        tab.back()
        expect(tab.page).toBe('/')
    })

    it('closing an overlay through its own UI consumes its entry, so Back leaves the page', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        const before = tab.length
        tab.open().closeFromUi()

        expect(tab.url).toBe('/maps')
        expect(tab.page).toBe('/maps')

        tab.back()
        expect(tab.page).toBe('/')
        expect(tab.length).toBe(before + 1)
    })

    it('an overlay that replaces another in the same commit reuses its entry', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        const placeholder = tab.open()
        const lengthWithOne = tab.length

        const settings = tab.swap(placeholder)
        expect(settings.open).toBe(true)
        expect(tab.length).toBe(lengthWithOne)

        tab.back()
        expect(settings.open).toBe(false)
        expect(tab.page).toBe('/maps')
        tab.back()
        expect(tab.page).toBe('/')
    })

    it('Forward after an overlay closed never reopens it and stays on the page', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        const closedByBack = tab.open()
        tab.back()
        tab.forward()
        expect(closedByBack.open).toBe(false)
        expect(tab.page).toBe('/maps')

        tab.open().closeFromUi()
        tab.forward()
        expect(tab.page).toBe('/maps')
        expect(tab.url).toBe('/maps')

        tab.back()
        expect(tab.page).toBe('/')
    })

    it('a link inside an overlay replaces its entry, so Back returns to the page under it', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        tab.navigate('/players', tab.open())

        expect(tab.length).toBe(3)
        tab.back()
        expect(tab.page).toBe('/maps')
        tab.forward()
        expect(tab.page).toBe('/players')
    })

    it('an overlay still open after a navigation closes on the next Back, before the page changes', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        const support = tab.open()
        tab.navigate('/players')

        tab.back()
        expect(support.open).toBe(false)
        expect(tab.page).toBe('/players')

        tab.back()
        expect(tab.page).toBe('/maps')
    })

    it('a link inside stacked overlays leaves one Back to the page under them and one Forward to the new page', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        const picker = tab.open()
        const support = tab.open()
        tab.navigate('/players', support, picker)

        tab.back()
        expect(tab.page).toBe('/maps')
        expect(tab.url).toBe('/maps')

        tab.forward()
        expect(tab.page).toBe('/players')
        expect(tab.url).toBe('/players')
    })

    it('a guarded page with an open overlay closes the overlay first, then asks on the next Back', () => {
        const tab = browserTab()
        tab.navigate('/events/cup')
        tab.setUnsaved('The tournament format has edits you have not saved yet.')
        const modal = tab.open()

        tab.back()
        expect(modal.open).toBe(false)
        expect(tab.blocked).toHaveLength(0)

        tab.back()
        expect(tab.blocked).toHaveLength(1)
        expect(tab.page).toBe('/events/cup')
        expect(tab.url).toBe('/events/cup')

        tab.blocked[0].move()
        tab.settle()
        expect(tab.page).toBe('/')
        expect(tab.blocked).toHaveLength(1)
    })

    it('closing an overlay while a link in it navigates leaves no entry behind', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        const modal = tab.open()
        modal.unmount()
        tab.step()
        tab.navigate('/players')

        expect(tab.page).toBe('/players')
        expect(tab.url).toBe('/players')
        expect(tab.length).toBe(3)
        tab.back()
        expect(tab.page).toBe('/maps')
    })

    it('two navigations while the history still passes a closed overlay entry both reach the history', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        tab.open().unmount()
        tab.step()
        tab.push('/players')
        tab.navigate('/servers')

        expect(tab.page).toBe('/servers')
        expect(tab.url).toBe('/servers')
        tab.back()
        expect(tab.page).toBe('/players')
        tab.back()
        expect(tab.page).toBe('/maps')
    })

    it('an in-app Forward with nothing ahead does not hold back the next navigation', () => {
        const tab = browserTab()
        tab.navigate('/maps')
        tab.sync.forward()
        tab.settle()
        tab.navigate('/players')

        expect(tab.url).toBe('/players')
        tab.back()
        expect(tab.page).toBe('/maps')
    })
})

describe('overlay history before the app attaches', () => {
    it('an overlay open on the first render gets its entry once the URL sync attaches', () => {
        const entries: unknown[] = [null]
        let index = 0
        const history: HistoryPort = {
            get state() { return entries[index] },
            pushState(state) { entries.splice(++index, entries.length, state) },
            replaceState(state) { entries[index] = state },
            go() {},
        }
        const sync = createHistorySync(history, task => task())
        sync.register(() => {})
        expect(entries).toHaveLength(1)

        sync.attach({ activeId: () => 0, leaveWarning: () => null, onBlocked: () => {}, show: () => {} }, '/')
        expect(entries).toEqual([{ navId: 0, position: 0 }, { navId: 0, position: 1, overlay: 1 }])
    })
})
