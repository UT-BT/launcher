import { gzipSync } from 'node:zlib'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assetsDir = fileURLToPath(new URL('../dist-web/assets/', import.meta.url))
const maxEntryGzipBytes = 275 * 1024
const files = await readdir(assetsDir)
const JavaScript = files.filter(file => file.endsWith('.js'))

if (JavaScript.length === 0) {
  throw new Error('No web JavaScript assets found. Run npm run build:web first.')
}

const sizes = await Promise.all(JavaScript.map(async file => {
  const contents = await readFile(join(assetsDir, file))
  return { file, bytes: contents.length, gzipBytes: gzipSync(contents).length }
}))
const entry = sizes.sort((a, b) => b.gzipBytes - a.gzipBytes)[0]

console.log(`Largest JavaScript chunk: ${entry.file} (${Math.round(entry.gzipBytes / 1024)} KiB gzip)`)
if (entry.gzipBytes > maxEntryGzipBytes) {
  throw new Error(`JavaScript chunk exceeds the ${maxEntryGzipBytes / 1024} KiB gzip budget.`)
}
