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
