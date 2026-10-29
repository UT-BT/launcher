import type { SeasonId } from '../seasons'
import { BAT_BODY, BAT_WING, MIRROR_BAT, seededRandom } from './shapes'

const COOLDOWN_MS = 10_000
const LIFETIME_MS = 2300
const PETAL_COLORS = ['#f9a8d4', '#fde68a', '#c4b5fd', '#86efac']

let lastBurstAt = -Infinity

function drift(season: SeasonId, angle: number, distance: number): [number, number] {
    const dx = Math.cos(angle) * distance
    if (season === 'halloween') return [dx, -Math.abs(Math.sin(angle) * distance) - 30]
    if (season === 'christmas') return [dx, Math.sin(angle) * distance * 0.6 + 50]
    return [dx, Math.sin(angle) * distance]
}

function particle(season: SeasonId, index: number, random: () => number): HTMLSpanElement {
    const element = document.createElement('span')
    if (season === 'halloween') {
        const width = 16 + Math.round(random() * 8)
        element.innerHTML = `<svg viewBox="0 0 40 20" width="${width}" fill="#1c1424" stroke="#a78bfa" stroke-width="1"><path d="${BAT_WING}"/><path d="${BAT_WING}" transform="${MIRROR_BAT}"/><path d="${BAT_BODY}"/></svg>`
    } else if (season === 'christmas') {
        element.className = 'seasonal-burst-flake'
        element.style.setProperty('--s', `${3 + Math.round(random() * 4)}px`)
    } else {
        element.className = 'seasonal-burst-petal'
        element.style.setProperty('--c', PETAL_COLORS[index % PETAL_COLORS.length])
    }
    return element
}

export function fireBurst(season: SeasonId, x: number, y: number): void {
    const now = Date.now()
    if (now - lastBurstAt < COOLDOWN_MS) return
    lastBurstAt = now

    const host = document.createElement('div')
    host.className = 'seasonal-burst'
    host.setAttribute('aria-hidden', 'true')
    host.style.setProperty('--bx', `${x}px`)
    host.style.setProperty('--by', `${y}px`)

    const random = seededRandom(now)
    const count = season === 'christmas' ? 14 : 12
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
