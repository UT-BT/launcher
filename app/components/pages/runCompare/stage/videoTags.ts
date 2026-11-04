import { useCallback, useState } from 'react'

const STORAGE_KEY = 'utbt:compareVideoTags:v1'

export interface VideoTags {
    names: boolean
    gap: boolean
}

export const DEFAULT_VIDEO_TAGS: VideoTags = { names: true, gap: true }

export function parseVideoTags(raw: string | null): VideoTags {
    try {
        const value: unknown = JSON.parse(raw ?? 'null')
        if (typeof value !== 'object' || value === null) return DEFAULT_VIDEO_TAGS
        const { names, gap } = value as Partial<VideoTags>
        return {
            names: typeof names === 'boolean' ? names : DEFAULT_VIDEO_TAGS.names,
            gap: typeof gap === 'boolean' ? gap : DEFAULT_VIDEO_TAGS.gap,
        }
    } catch {
        return DEFAULT_VIDEO_TAGS
    }
}

function loadVideoTags(): VideoTags {
    try {
        return parseVideoTags(window.localStorage.getItem(STORAGE_KEY))
    } catch {
        return DEFAULT_VIDEO_TAGS
    }
}

function saveVideoTags(tags: VideoTags): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tags))
    } catch {
        return
    }
}

export function useVideoTags(): [VideoTags, (next: VideoTags) => void] {
    const [tags, setTags] = useState(loadVideoTags)
    const update = useCallback((next: VideoTags) => {
        setTags(next)
        saveVideoTags(next)
    }, [])
    return [tags, update]
}
