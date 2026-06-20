import {
    Megaphone, Calendar, Download, Gamepad2, Newspaper, Trophy, Flag, Package,
    Star, Bell, Rocket, Wrench, Gift, Zap, Users, Map, Sparkles, Bug, Shield,
    Heart, Crown, Swords, PartyPopper, type LucideIcon,
} from 'lucide-react'

export const NEWS_ICONS: Record<string, LucideIcon> = {
    Megaphone, Calendar, Download, Gamepad2, Newspaper, Trophy, Flag, Package,
    Star, Bell, Rocket, Wrench, Gift, Zap, Users, Map, Sparkles, Bug, Shield,
    Heart, Crown, Swords, PartyPopper,
}

export const NEWS_ICON_NAMES = Object.keys(NEWS_ICONS)

export function getNewsIcon(name?: string | null): LucideIcon {
    return (name && NEWS_ICONS[name]) || Newspaper
}
