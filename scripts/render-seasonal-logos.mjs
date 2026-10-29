import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const master = join(root, 'app', 'public', 'icon-512.png')
const outputDir = join(root, 'app', 'assets', 'seasonal')
const outputSize = 256
const outline = '#0b0b0f'

function seeded(seed) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function specks(seed, count, colors, minRadius, maxRadius) {
  const random = seeded(seed)
  return Array.from({ length: count }, (_, index) => {
    const x = (20 + random() * 472).toFixed(1)
    const y = (20 + random() * 472).toFixed(1)
    const r = (minRadius + random() * (maxRadius - minRadius)).toFixed(1)
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${colors[index % colors.length]}"/>`
  }).join('')
}

function eggs(seed, count, colors) {
  const random = seeded(seed)
  return Array.from({ length: count }, (_, index) => {
    const x = (24 + random() * 464).toFixed(1)
    const y = (24 + random() * 464).toFixed(1)
    const rotate = Math.round(random() * 60 - 30)
    return `<ellipse cx="${x}" cy="${y}" rx="4" ry="5.4" transform="rotate(${rotate} ${x} ${y})" fill="${colors[index % colors.length]}" stroke="${outline}" stroke-width="1.2"/>`
  }).join('')
}

function cubicStitches([p0, p1, p2, p3], steps, length) {
  return steps.map(t => {
    const u = 1 - t
    const x = u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0]
    const y = u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]
    const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0])
    const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
    const norm = Math.hypot(dx, dy)
    return [x, y, -dy / norm, dx / norm]
  }).map(([x, y, nx, ny]) => {
    const half = length / 2
    return `<line x1="${(x - nx * half).toFixed(1)}" y1="${(y - ny * half).toFixed(1)}" x2="${(x + nx * half).toFixed(1)}" y2="${(y + ny * half).toFixed(1)}"/>`
  }).join('')
}

const CHEEK_SCAR = [[258, 266], [274, 280], [292, 296], [320, 309]]
const cheekScarPath = `M ${CHEEK_SCAR[0].join(' ')} C ${CHEEK_SCAR.slice(1).map(point => point.join(' ')).join(', ')}`

function smoothPath(points, closed) {
  const padded = closed ? [points.at(-1), ...points, points[0], points[1]] : [points[0], ...points, points.at(-1)]
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < padded.length - 2; i++) {
    const [p0, p1, p2, p3] = [padded[i - 1], padded[i], padded[i + 1], padded[i + 2]]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`
  }
  return closed ? `${d} Z` : d
}

const BEARD_TOP = [[388, 286], [362, 290], [332, 288], [302, 282], [274, 273], [252, 263], [242, 258]]
const BEARD_BACK = [[236, 270], [234, 288], [236, 304], [243, 316], [252, 326]]
const BEARD_TIPS = [[262, 340], [287, 357], [313, 374], [339, 396], [365, 411], [390, 401], [409, 373]]
const BEARD_FRONT = [[414, 352], [417, 336], [418, 322], [420, 310], [422, 298], [424, 288], [422, 281], [408, 282]]

const BEARD_VALLEYS = BEARD_TIPS.slice(1).map(([x, y], index) => {
  const [px, py] = BEARD_TIPS[index]
  return [Math.round((px + x) / 2 + 2), Math.round(Math.min(py, y) - 9 - (index % 2) * 4)]
})

const BEARD_POINTS = [
  ...BEARD_TOP,
  ...BEARD_BACK,
  ...BEARD_TIPS.flatMap(([tx, ty], index) => {
    const curl = [tx + 5, ty - 7]
    return index < BEARD_VALLEYS.length ? [[tx, ty], curl, BEARD_VALLEYS[index]] : [[tx, ty], curl]
  }),
  ...BEARD_FRONT,
]

const BEARD = smoothPath(BEARD_POINTS, true)
const BEARD_TOP_EDGE = smoothPath(BEARD_TOP, false)

function beardTopY(x) {
  const line = [...BEARD_TOP].reverse()
  for (let i = 1; i < line.length; i++) {
    const [x0, y0] = line[i - 1]
    const [x1, y1] = line[i]
    if (x <= x1) return y0 + ((y1 - y0) * (Math.max(x, x0) - x0)) / (x1 - x0)
  }
  return line.at(-1)[1]
}

function beardStrands() {
  return BEARD_TIPS.flatMap(([tx, ty], index) => [[-24, 0], [-11, 6]].map(([back, shorten]) => {
    const sx = Math.max(248, tx + back)
    const sy = beardTopY(sx) + 7 + (index % 2) * 3
    const end = [tx + 2 + back / 6, ty - 12 - shorten]
    const mid = (sy + end[1]) / 2
    const sway = 9 + (index % 3) * 2
    return `<path d="M ${sx} ${sy.toFixed(1)} C ${(sx + sway).toFixed(1)} ${(mid - 8).toFixed(1)} ${(end[0] - sway).toFixed(1)} ${(mid + 10).toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}"/>`
  })).join('')
}

function beardShading() {
  return BEARD_VALLEYS.map(([vx, vy]) => `<path d="M ${vx} ${vy - 2} C ${vx - 3} ${vy - 12} ${vx - 1} ${vy - 20} ${vx - 4} ${vy - 28}"/>`).join('')
}

function beardRoots() {
  const strokes = []
  for (let x = 252; x <= 384; x += 10) {
    const y = beardTopY(x)
    const reach = 7 + ((x / 10) % 3) * 2.5
    strokes.push(`<path d="M ${x} ${(y - 3).toFixed(1)} q 1.5 ${(reach / 2).toFixed(1)} 4 ${reach.toFixed(1)}"/>`)
  }
  return strokes.join('')
}

const EAR_SCAR = [[151, 150], [164, 155], [182, 165], [198, 172]]
const earScarPath = `M ${EAR_SCAR[0].join(' ')} C ${EAR_SCAR.slice(1).map(point => point.join(' ')).join(', ')}`

const MOUSTACHE = 'M 422 278 C 412 272 394 272 382 280 C 374 285 368 292 370 299 C 372 304 378 303 379 298 C 380 292 386 288 394 287 C 404 286 414 284 422 282 Z'
const MOUSTACHE_LOWER = 'M 416 285 C 406 284 394 288 388 295 C 384 300 385 306 390 306 C 390 300 395 295 402 293 C 409 291 414 290 417 289 Z'

const svg = body => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${body}</svg>`

const SEASONS = {
  halloween: {
    fur: [206, 201, 189],
    swirl: {
      red: { light: { h: 26, s: 0.95, scale: 1, lift: 0.02 }, dark: { h: 286, s: 0.55, scale: 0.85, lift: 0 } },
      blue: { light: { h: 272, s: 0.6, scale: 0.95, lift: 0 }, dark: { h: 270, s: 0.45, scale: 0.55, lift: 0 } },
    },
    layers: [
      {
        mask: 'fur',
        svg: svg(`
          <defs>
            <filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>
            <filter id="pucker"><feGaussianBlur stdDeviation="1.8"/></filter>
          </defs>
          <ellipse cx="336" cy="262" rx="26" ry="9" fill="rgb(70,40,60)" opacity="0.35" filter="url(#soft)"/>
          <path d="${cheekScarPath}" fill="none" stroke="rgb(90,40,50)" stroke-width="13" stroke-linecap="round" opacity="0.25" filter="url(#pucker)"/>
          <path d="${earScarPath}" fill="none" stroke="#5a0f14" stroke-width="4.5" stroke-linecap="round"/>
          <path d="${earScarPath}" fill="none" stroke="#b5606c" stroke-width="1.6" stroke-linecap="round"/>
          <g stroke="${outline}" stroke-width="2.4" stroke-linecap="round">${cubicStitches(EAR_SCAR, [0.15, 0.4, 0.65, 0.88], 10)}</g>
          <g fill="#7a0a10">
            <circle cx="352" cy="292" r="2.4"/><circle cx="364" cy="299" r="1.8"/><circle cx="345" cy="301" r="1.5"/>
            <circle cx="374" cy="287" r="1.3"/><circle cx="358" cy="281" r="1.1"/><circle cx="381" cy="297" r="1.5"/>
          </g>`),
      },
      {
        mask: 'none',
        svg: svg(`
          <defs><filter id="glow" x="-100%" y="-200%" width="300%" height="500%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter></defs>
          <g transform="rotate(23 336 245)">
            <ellipse cx="336" cy="245" rx="15" ry="5.5" fill="#ff2a2a" filter="url(#glow)"/>
            <ellipse cx="338" cy="244" rx="4" ry="2" fill="#ffd6d6"/>
          </g>
          <path d="${cheekScarPath}" fill="none" stroke="#6e1a26" stroke-width="7" stroke-linecap="round"/>
          <path d="${cheekScarPath}" fill="none" stroke="#c76b78" stroke-width="3" stroke-linecap="round"/>
          <g stroke="${outline}" stroke-width="2.6" stroke-linecap="round">${cubicStitches(CHEEK_SCAR, [0.1, 0.3, 0.5, 0.7, 0.9], 15)}</g>
          <defs><linearGradient id="blood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e060b"/><stop offset="1" stop-color="#931019"/></linearGradient></defs>
          <g fill="url(#blood)" stroke="#2a0205" stroke-width="0.7" stroke-linejoin="round">
            <path d="M 390 277 C 395 281 401 285 407 288 C 410 289 412 291 412 294 C 412 297 411 299 411 300 C 411 312 412 326 413 336 C 414 343 412 347 409 347 C 405 347 404 342 405 336 C 406 326 406 314 405 304 C 404 306 402 307 401 305 C 401 312 401 318 401 322 C 401 327 399 329 397 328 C 395 327 395 323 396 319 C 396 314 396 309 395 305 C 394 304 393 303 392 301 C 392 305 392 308 391 311 C 390 314 387 314 387 311 C 387 308 389 305 389 300 C 389 292 389 283 390 277 Z"/>
            <path d="M 410 354 C 410 358 413 361 413 364 C 413 367 407 367 407 364 C 407 361 410 358 410 354 Z"/>
          </g>
          <g fill="none" stroke="#e0505a" stroke-linecap="round" opacity="0.85">
            <path d="M 407 304 C 407 316 408 326 409 336" stroke-width="1.2"/><path d="M 398 306 C 398 312 398 318 398 322" stroke-width="1"/>
            <path d="M 392 281 C 397 285 402 288 407 290" stroke-width="1"/>
          </g>
          <g fill="#f4a3a8"><circle cx="407.5" cy="342" r="1.3"/><circle cx="397" cy="324" r="0.9"/><circle cx="389" cy="309" r="0.7"/><circle cx="409" cy="362" r="0.8"/></g>`),
      },
    ],
  },
  christmas: {
    fur: null,
    swirl: {
      red: { light: { h: 356, s: 0.85, scale: 1, lift: 0 }, dark: { h: 352, s: 0.75, scale: 0.85, lift: 0 } },
      blue: { light: { h: 145, s: 0.55, scale: 0.9, lift: 0 }, dark: { h: 155, s: 0.6, scale: 0.6, lift: 0 } },
    },
    layers: [
      {
        mask: 'fur',
        svg: svg(`
          <defs><radialGradient id="rosy"><stop offset="0" stop-color="#ff6b81" stop-opacity="0.6"/><stop offset="1" stop-color="#ff6b81" stop-opacity="0"/></radialGradient></defs>
          <circle cx="296" cy="266" r="24" fill="url(#rosy)"/>`),
      },
      {
        mask: 'swirl',
        svg: svg(`${specks(11, 70, ['#f8fafc', '#f8fafc', '#e2e8f0'], 1.4, 3.6)}${specks(29, 40, ['#f5c542', '#fde68a'], 1.2, 2.8)}`),
      },
      {
        mask: 'none',
        svg: svg(`
          <defs>
            <linearGradient id="beard" x1="236" y1="0" x2="424" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#d2dae6"/><stop offset="0.5" stop-color="#f4f7fb"/><stop offset="1" stop-color="#ffffff"/>
            </linearGradient>
            <filter id="beardSoft"><feGaussianBlur stdDeviation="2.2"/></filter>
          </defs>
          <path d="${BEARD}" fill="url(#beard)"/>
          <path d="${BEARD_TOP_EDGE}" fill="none" stroke="#cfd8e3" stroke-width="6" stroke-linecap="round" opacity="0.8" filter="url(#beardSoft)"/>
          <g fill="none" stroke="#c3cddb" stroke-width="5" stroke-linecap="round" filter="url(#beardSoft)">${beardShading()}</g>
          <g fill="none" stroke="#bcc7d5" stroke-width="2" stroke-linecap="round">${beardStrands()}</g>
          <g fill="none" stroke="#d5dde7" stroke-width="1.6" stroke-linecap="round">${beardRoots()}</g>`),
      },
      {
        mask: 'notFur',
        svg: svg(`<path d="${BEARD}" fill="none" stroke="${outline}" stroke-width="5" stroke-linejoin="round"/>`),
      },
      {
        mask: 'none',
        svg: svg(`
          <path d="${MOUSTACHE_LOWER}" fill="#eef2f7" stroke="${outline}" stroke-width="3.5" stroke-linejoin="round"/>
          <path d="${MOUSTACHE}" fill="#f8fafc" stroke="${outline}" stroke-width="3.5" stroke-linejoin="round"/>
          <g fill="none" stroke="#a8b5c7" stroke-width="1.6" stroke-linecap="round">
            <path d="M 416 279 C 404 277 392 280 384 287"/><path d="M 410 283 C 400 283 390 287 383 293"/><path d="M 410 288 C 401 289 394 293 390 299"/>
          </g>
          <g transform="translate(322 200) rotate(10)" stroke="${outline}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round">
            <path d="M -60 -12 C -58 -60 -24 -96 14 -100 C 48 -102 66 -70 64 -12 Z" fill="#d61f2c"/>
            <path d="M -6 -96 C -44 -112 -90 -102 -116 -70 C -110 -64 -104 -60 -96 -58 C -82 -80 -50 -88 -20 -78 Z" fill="#d61f2c"/>
            <path d="M 34 -88 C 54 -72 60 -46 58 -16" fill="none" stroke="#8f111b" stroke-width="10"/>
            <circle cx="-112" cy="-62" r="17" fill="#f8fafc"/>
            <rect x="-70" y="-16" width="140" height="30" rx="15" fill="#f8fafc"/>
            <path d="M -58 6 Q 0 10 58 6" fill="none" stroke="#cbd5e1" stroke-width="4"/>
          </g>`),
      },
    ],
  },
  easter: {
    fur: null,
    ears: { color: [255, 194, 214], seeds: [[180, 165], [140, 205]], fadeX: [226, 262], fadeY: [226, 244] },
    swirl: {
      red: { light: { h: 335, s: 0.75, scale: 0.45, lift: 0.45 }, dark: { h: 285, s: 0.45, scale: 0.5, lift: 0.35 } },
      blue: { light: { h: 160, s: 0.5, scale: 0.4, lift: 0.5 }, dark: { h: 255, s: 0.45, scale: 0.5, lift: 0.33 } },
    },
    layers: [
      {
        mask: 'fur',
        svg: svg(`
          <defs><radialGradient id="blush"><stop offset="0" stop-color="#ff8fb1" stop-opacity="0.55"/><stop offset="1" stop-color="#ff8fb1" stop-opacity="0"/></radialGradient></defs>
          <circle cx="300" cy="292" r="28" fill="url(#blush)"/>`),
      },
      {
        mask: 'swirl',
        svg: svg(`${eggs(7, 26, ['#fde68a', '#fbcfe8', '#c4b5fd', '#a7f3d0', '#f8fafc'])}${specks(19, 30, ['#f9a8d4', '#fde68a'], 1.2, 2.4)}`),
      },
      {
        mask: 'none',
        svg: svg(`
          <path d="M 240 202 C 272 180 320 178 356 190 C 376 198 390 208 400 220" fill="none" stroke="${outline}" stroke-width="11" stroke-linecap="round"/>
          <path d="M 240 202 C 272 180 320 178 356 190 C 376 198 390 208 400 220" fill="none" stroke="#16a34a" stroke-width="5" stroke-linecap="round"/>
          ${[[246, 196, -150, 1.1], [298, 176, -70, 1], [358, 188, -40, 1], [394, 214, 30, 0.9]].map(([x, y, r, s]) => `<path d="M 0 0 C 8 -10 22 -10 30 0 C 22 10 8 10 0 0 Z" transform="translate(${x} ${y}) rotate(${r}) scale(${s})" fill="#4ade80" stroke="${outline}" stroke-width="3" stroke-linejoin="round"/>`).join('')}
          ${[[264, 182, '#fbcfe8', 25, 10], [326, 178, '#fef3c7', 27, -8], [382, 202, '#ddd6fe', 22, 20]].map(([x, y, fill, r, rot]) => `<g transform="translate(${x} ${y}) rotate(${rot})" stroke="${outline}" stroke-width="4">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="${-r * 0.62}" rx="${r * 0.48}" ry="${r * 0.66}" fill="${fill}" transform="rotate(${a})"/>`).join('')}<circle r="${r * 0.34}" fill="#f59e0b"/></g>`).join('')}`),
      },
    ],
  },
}

async function render(browser, masterUrl, season, config) {
  const page = await browser.newPage()
  try {
    return await page.evaluate(async ({ masterUrl, config, outputSize }) => {
      const { Image, OffscreenCanvas, btoa } = globalThis
      const load = src => new Promise((done, failed) => {
        const image = new Image()
        image.onload = () => done(image)
        image.onerror = () => failed(new Error('image failed to load'))
        image.src = src
      })
      const size = 512
      const canvas = new OffscreenCanvas(size, size)
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(await load(masterUrl), 0, 0, size, size)
      const image = context.getImageData(0, 0, size, size)
      const px = image.data

      const hsl = (r, g, b) => {
        r /= 255; g /= 255; b /= 255
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const l = (max + min) / 2
        if (max === min) return [0, 0, l]
        const d = max - min
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
        return [h * 60, s, l]
      }
      const rgb = (h, s, l) => {
        const k = n => (n + h / 30) % 12
        const a = s * Math.min(l, 1 - l)
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
        return [f(0) * 255, f(8) * 255, f(4) * 255]
      }
      const clamp = value => Math.min(1, Math.max(0, value))
      const smooth = (edge0, edge1, x) => {
        const t = clamp((x - edge0) / (edge1 - edge0))
        return t * t * (3 - 2 * t)
      }

      const kind = new Uint8Array(size * size)
      for (let i = 0; i < size * size; i++) {
        const o = i * 4
        if (px[o + 3] < 8) continue
        const [, s, l] = hsl(px[o], px[o + 1], px[o + 2])
        kind[i] = s < 0.18 || l < 0.1 || l > 0.92 ? 1 : 2
      }

      const white = i => kind[i] === 1 && (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3 > 150
      const component = new Int32Array(size * size).fill(-1)
      const touchesOutside = []
      let next = 0
      for (let start = 0; start < size * size; start++) {
        if (!white(start) || component[start] !== -1) continue
        const id = next++
        let outside = false
        const stack = [start]
        component[start] = id
        while (stack.length) {
          const i = stack.pop()
          const x = i % size
          const y = (i - x) / size
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) { outside = true; continue }
            const n = ny * size + nx
            if (px[n * 4 + 3] < 128) outside = true
            if (white(n) && component[n] === -1) { component[n] = id; stack.push(n) }
          }
        }
        touchesOutside.push(outside)
      }

      const fur = new Uint8Array(size * size)
      for (let i = 0; i < size * size; i++) {
        if (component[i] >= 0 && !touchesOutside[component[i]]) fur[i] = 1
      }
      const grow = mask => {
        const out = mask.slice()
        for (let i = 0; i < size * size; i++) {
          if (mask[i] || kind[i] !== 1) continue
          const x = i % size
          const y = (i - x) / size
          if ((x > 0 && mask[i - 1]) || (x < size - 1 && mask[i + 1]) || (y > 0 && mask[i - size]) || (y < size - 1 && mask[i + size])) out[i] = 1
        }
        return out
      }
      const furEdge = grow(grow(fur))

      const ear = new Uint8Array(size * size)
      if (config.ears) {
        const ids = new Set(config.ears.seeds.map(([x, y]) => component[y * size + x]).filter(id => id >= 0))
        for (let i = 0; i < size * size; i++) if (ids.has(component[i])) ear[i] = 1
      }
      const earEdge = config.ears ? grow(grow(ear)) : ear
      const earWeight = i => {
        const x = i % size
        const y = (i - x) / size
        const { fadeX, fadeY } = config.ears
        return (1 - smooth(fadeX[0], fadeX[1], x)) * (1 - smooth(fadeY[0], fadeY[1], y))
      }

      const swirlMask = new Uint8Array(size * size)
      for (let i = 0; i < size * size; i++) {
        const o = i * 4
        if (kind[i] === 2) {
          swirlMask[i] = 1
          const [h, s, l] = hsl(px[o], px[o + 1], px[o + 2])
          const family = h >= 300 || h < 60 ? config.swirl.red : config.swirl.blue
          const t = smooth(0.28, 0.5, l)
          const mix = (a, b) => a + (b - a) * t
          let hue = mix(family.dark.h, family.light.h)
          if (Math.abs(family.dark.h - family.light.h) > 180) {
            const darkH = family.dark.h < family.light.h ? family.dark.h + 360 : family.dark.h
            const lightH = family.light.h < family.dark.h ? family.light.h + 360 : family.light.h
            hue = (darkH + (lightH - darkH) * t) % 360
          }
          const sat = clamp(mix(family.dark.s, family.light.s) * Math.min(1, s * 1.4))
          const light = clamp(l * mix(family.dark.scale, family.light.scale) + mix(family.dark.lift, family.light.lift))
          const [r, g, b] = rgb(hue, sat, light)
          px[o] = r; px[o + 1] = g; px[o + 2] = b
        } else if (kind[i] === 1) {
          const v = (px[o] + px[o + 1] + px[o + 2]) / 765
          const base = config.fur && furEdge[i] ? config.fur : [255, 255, 255]
          const weight = config.ears && earEdge[i] ? earWeight(i) : 0
          const tint = base.map((channel, c) => channel + (config.ears ? (config.ears.color[c] - channel) * weight : 0))
          if (config.fur || weight > 0) {
            px[o] = tint[0] * v; px[o + 1] = tint[1] * v; px[o + 2] = tint[2] * v
          }
        }
      }
      context.putImageData(image, 0, 0)

      const masks = { fur: furEdge, swirl: swirlMask, notFur: furEdge.map(value => (value ? 0 : 1)) }
      for (const layer of config.layers) {
        const art = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(layer.svg)}`)
        const scratch = new OffscreenCanvas(size, size)
        const scratchContext = scratch.getContext('2d', { willReadFrequently: true })
        scratchContext.drawImage(art, 0, 0, size, size)
        if (layer.mask !== 'none') {
          const mask = masks[layer.mask]
          const data = scratchContext.getImageData(0, 0, size, size)
          for (let i = 0; i < size * size; i++) if (!mask[i]) data.data[i * 4 + 3] = 0
          scratchContext.putImageData(data, 0, 0)
        }
        context.drawImage(scratch, 0, 0)
      }

      const toDataUrl = async (source, width, type, quality) => {
        const target = new OffscreenCanvas(width, width)
        const targetContext = target.getContext('2d')
        targetContext.imageSmoothingQuality = 'high'
        targetContext.drawImage(source, 0, 0, width, width)
        const blob = await target.convertToBlob({ type, quality })
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let binary = ''
        for (const byte of bytes) binary += String.fromCharCode(byte)
        return btoa(binary)
      }
      return {
        webp: await toDataUrl(canvas, outputSize, 'image/webp', 0.9),
        preview: await toDataUrl(canvas, size, 'image/png'),
      }
    }, { masterUrl, config, outputSize })
  } finally {
    await page.close()
  }
}

async function main() {
  const { values } = parseArgs({ options: { preview: { type: 'string' } } })
  const masterUrl = `data:image/png;base64,${(await readFile(master)).toString('base64')}`
  await mkdir(outputDir, { recursive: true })
  if (values.preview) await mkdir(resolve(values.preview), { recursive: true })
  const browser = await chromium.launch()
  try {
    for (const [season, config] of Object.entries(SEASONS)) {
      const { webp, preview } = await render(browser, masterUrl, season, config)
      const file = join(outputDir, `logo-${season}.webp`)
      await writeFile(file, Buffer.from(webp, 'base64'))
      if (values.preview) await writeFile(join(resolve(values.preview), `logo-${season}.png`), Buffer.from(preview, 'base64'))
      console.log(`${season}: ${file} (${Math.round(Buffer.from(webp, 'base64').length / 1024)} KiB)`)
    }
  } finally {
    await browser.close()
  }
}

await main()
