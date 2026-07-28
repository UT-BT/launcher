import type { CapItAllRow } from '@/app/utils/api'

export interface CapItAllPageState {
    search: string
    currentPage: number
    pageSizePreference: number | 'auto'
    scrollTop: number
}

export interface CapItAllPageCaches {
    items: CapItAllRow[]
    total: number
    mapCount: number
    lastRefreshIso: string | null
    querySig: string | null
}

export const DEFAULT_CAP_IT_ALL_STATE: CapItAllPageState = {
    search: '',
    currentPage: 1,
    pageSizePreference: 'auto',
    scrollTop: 0,
}

export const DEFAULT_CAP_IT_ALL_CACHES: CapItAllPageCaches = {
    items: [],
    total: 0,
    mapCount: 0,
    lastRefreshIso: null,
    querySig: null,
}
