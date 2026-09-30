import { useEffect } from 'react'
import './broadcastFonts.css'

export const BROADCAST_FONTS = ['600 1em "Barlow Condensed"', '700 1em "Barlow Condensed"', 'italic 800 1em "Barlow Condensed"', 'italic 900 1em "Barlow Condensed"']

export function useBroadcastFonts(): void {
    useEffect(() => {
        const fonts = document.fonts
        if (!fonts) return
        for (const font of BROADCAST_FONTS) void fonts.load(font).catch(() => [])
    }, [])
}
