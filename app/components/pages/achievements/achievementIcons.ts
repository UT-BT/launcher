import {
    Sparkles, Award, Crown,
    Clock, Map as MapIcon, Trophy, Medal, Star, Swords, Tags, Globe, Shield, Wind, Flame,
    Users, Handshake, ShieldCheck, Zap, Gem,
    Hammer, Hourglass, Heart, PenTool, Blocks, Repeat,
    Eye, TrendingUp, Percent, Dices, Coins, Ticket,
    type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
    Clock, Map: MapIcon, Crown, Medal, Award, Trophy, Swords, Star, Tags, Globe, Shield, Wind, Flame, Sparkles,
    Users, Handshake, ShieldCheck, Zap, Gem,
    Hammer, Hourglass, Heart, PenTool, Blocks, Repeat,
    Eye, TrendingUp, Percent, Dices, Coins, Ticket,
}

export function achievementIcon(name: string): LucideIcon {
    return ICONS[name] ?? Award
}
