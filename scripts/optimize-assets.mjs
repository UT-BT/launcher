/**
 * Regenerates the WebP copies of app/assets/*.png.
 *
 * The PNGs stay in the repo as the editable source; the committed .webp files
 * next to them are what the app actually imports. Run this after changing any
 * source PNG, then commit both.
 *
 *   node scripts/optimize-assets.mjs
 *
 * Dimensions are deliberately preserved. Every one of these is 256x256 and gets
 * rendered far smaller (medals at 12-20px, the logo at up to 96px), so there is
 * room to downscale -- but the desktop splash animation scales the logo up, and
 * a future page could render a medal larger. Format alone gets ~two thirds off
 * without having to reason about any of that.
 */
import { readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const assetsDir = fileURLToPath(new URL('../app/assets/', import.meta.url))
const QUALITY = 90

const files = (await readdir(assetsDir)).filter(file => file.endsWith('.png')).sort()

if (files.length === 0) {
  throw new Error(`No PNG sources found in ${assetsDir}`)
}

let totalPng = 0
let totalWebp = 0

for (const file of files) {
  const source = join(assetsDir, file)
  const target = source.replace(/\.png$/, '.webp')

  const encoded = await sharp(source).webp({ quality: QUALITY, effort: 6 }).toBuffer()
  await writeFile(target, encoded)

  const pngBytes = (await stat(source)).size
  totalPng += pngBytes
  totalWebp += encoded.length

  const saved = Math.round((1 - encoded.length / pngBytes) * 100)
  console.log(`${file.padEnd(22)} ${String(pngBytes).padStart(7)} -> ${String(encoded.length).padStart(7)} B  (-${saved}%)`)
}

const saved = Math.round((1 - totalWebp / totalPng) * 100)
console.log(`${'TOTAL'.padEnd(22)} ${String(totalPng).padStart(7)} -> ${String(totalWebp).padStart(7)} B  (-${saved}%)`)
