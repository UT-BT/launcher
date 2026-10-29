const SIDEBAR_COLLAPSED_KEY = 'utbt:sidebarCollapsed:v1'

export function readSidebarCollapsed(): boolean {
    try {
        return JSON.parse(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) ?? 'false') === true
    } catch {
        return false
    }
}

export function writeSidebarCollapsed(collapsed: boolean): void {
    try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(collapsed))
    } catch {
        return
    }
}
