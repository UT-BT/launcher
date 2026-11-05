import type { EntryId } from '../seasons'
import { BAT_BODY, BAT_WING, BLOSSOM_COLORS, GOLD_COLORS, ICE_CRYSTAL, LEAF, LEAF_COLORS, LEAF_VEIN, MIRROR_BAT, STAR, seededRandom } from './shapes'

const COOLDOWN_MS = 10_000
const LIFETIME_MS = 2300
const PETAL_COLORS = ['#f9a8d4', '#fde68a', '#c4b5fd', '#86efac']
const SEASON_BURST_PARTICLES = 10
const SEASON_ENTRIES: ReadonlySet<EntryId> = new Set(['spring', 'summer', 'autumn', 'winter'])

let lastBurstAt = -Infinity

function drift(season: EntryId, angle: number, distance: number): [number, number] {
    const dx = Math.cos(angle) * distance
    if (season === 'halloween') return [dx, -Math.abs(Math.sin(angle) * distance) - 30]
    if (season === 'christmas') return [dx, Math.sin(angle) * distance * 0.6 + 50]
    if (season === 'spring') return [dx, Math.sin(angle) * distance * 0.7 + 25]
    if (season === 'autumn') return [dx * 0.8, Math.abs(Math.sin(angle) * distance) * 0.5 + 40]
    if (season === 'winter') return [dx, Math.sin(angle) * distance * 0.6 + 35]
    if (season === 'christmas-summer') return [dx, Math.sin(angle) * distance * 0.7 + 20]
    return [dx, Math.sin(angle) * distance]
}

function particle(season: EntryId, index: number, random: () => number): HTMLSpanElement {
    const element = document.createElement('span')
    if (season === 'halloween') {
        const width = 16 + Math.round(random() * 8)
        element.innerHTML = `<svg viewBox="0 0 40 20" width="${width}" fill="#1c1424" stroke="#a78bfa" stroke-width="1"><path d="${BAT_WING}"/><path d="${BAT_WING}" transform="${MIRROR_BAT}"/><path d="${BAT_BODY}"/></svg>`
    } else if (season === 'christmas') {
        element.className = 'seasonal-burst-flake'
        element.style.setProperty('--s', `${3 + Math.round(random() * 4)}px`)
    } else if (season === 'summer') {
        element.className = 'seasonal-burst-spark'
    } else if (season === 'spring') {
        element.className = 'seasonal-burst-petal'
        element.style.setProperty('--c', BLOSSOM_COLORS[index % BLOSSOM_COLORS.length])
    } else if (season === 'autumn') {
        const size = 12 + Math.round(random() * 6)
        element.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" fill="${LEAF_COLORS[index % LEAF_COLORS.length]}" stroke="#451a03" stroke-opacity="0.5" stroke-width="1.2"><path d="${LEAF}" stroke="none"/><path d="${LEAF_VEIN}" fill="none"/></svg>`
    } else if (season === 'winter') {
        const size = 10 + Math.round(random() * 5)
        element.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" fill="none" stroke="#e0f2fe" stroke-width="1.6" stroke-linecap="round"><path d="${ICE_CRYSTAL}"/></svg>`
    } else if (season === 'christmas-summer' && index % 2 === 0) {
        const size = 11 + Math.round(random() * 6)
        element.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" fill="${GOLD_COLORS[(index / 2) % GOLD_COLORS.length]}" stroke="#b45309" stroke-opacity="0.6" stroke-width="1" stroke-linejoin="round"><path d="${STAR}"/></svg>`
    } else if (season === 'christmas-summer') {
        element.className = 'seasonal-burst-bauble'
        element.style.setProperty('--s', `${5 + Math.round(random() * 3)}px`)
    } else {
        element.className = 'seasonal-burst-petal'
        element.style.setProperty('--c', PETAL_COLORS[index % PETAL_COLORS.length])
    }
    return element
}

export function fireBurst(season: EntryId, x: number, y: number): void {
    const now = Date.now()
    if (now - lastBurstAt < COOLDOWN_MS) return
    lastBurstAt = now

    const host = document.createElement('div')
    host.className = 'seasonal-burst'
    host.setAttribute('aria-hidden', 'true')
    host.style.setProperty('--bx', `${x}px`)
    host.style.setProperty('--by', `${y}px`)

    const random = seededRandom(now)
    const count = season === 'christmas' ? 14 : SEASON_ENTRIES.has(season) ? SEASON_BURST_PARTICLES : 12
    for (let index = 0; index < count; index++) {
        const angle = (index / count) * Math.PI * 2 + random() * 0.5
        const [dx, dy] = drift(season, angle, 60 + random() * 70)
        const element = particle(season, index, random)
        element.style.setProperty('--dx', `${dx.toFixed(0)}px`)
        element.style.setProperty('--dy', `${dy.toFixed(0)}px`)
        element.style.setProperty('--r', `${Math.round(random() * 540 - 270)}deg`)
        element.style.animationDelay = `${Math.round(random() * 160)}ms`
        host.appendChild(element)
    }

    document.body.appendChild(host)
    window.setTimeout(() => host.remove(), LIFETIME_MS)
}
