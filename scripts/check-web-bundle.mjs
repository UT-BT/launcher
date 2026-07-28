import { gzipSync } from 'node:zlib'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const distDir = fileURLToPath(new URL('../dist-web/', import.meta.url))
const assetsDir = join(distDir, 'assets')

const KiB = 1024
const maxInitialJsGzipBytes = 190 * KiB
const maxInitialCssGzipBytes = 32 * KiB
const maxInitialTotalGzipBytes = 220 * KiB
const maxLazyChunkGzipBytes = 120 * KiB
const maxTotalJsGzipBytes = 700 * KiB
const minEntryGzipBytes = 50 * KiB

const HEAD_START = '<!--utbt-head-start-->'
const HEAD_END = '<!--utbt-head-end-->'

const failures = []

function fail(message) {
  failures.push(message)
}

function formatKiB(bytes) {
  return `${Math.round(bytes / KiB)} KiB`
}

async function gzipBytesOf(file) {
  return gzipSync(await readFile(join(distDir, file))).length
}

async function sumGzipBytes(files) {
  const sizes = await Promise.all(files.map(gzipBytesOf))
  return sizes.reduce((total, bytes) => total + bytes, 0)
}

function checkBudget(label, actual, budget) {
  const withinBudget = actual <= budget
  console.log(`${withinBudget ? '  ok  ' : ' FAIL '} ${label}: ${formatKiB(actual)} (budget ${formatKiB(budget)})`)
  if (!withinBudget) {
    fail(`${label} is ${formatKiB(actual)}, over the ${formatKiB(budget)} budget.`)
  }
}

function collectInitialPayload(manifest, entryKey) {
  const visited = new Set()
  const javaScript = new Set()
  const styles = new Set()

  const visit = key => {
    if (visited.has(key)) return
    visited.add(key)

    const record = manifest[key]
    if (!record) return

    if (record.file) javaScript.add(record.file)
    for (const file of record.css ?? []) styles.add(file)
    for (const imported of record.imports ?? []) visit(imported)
  }

  visit(entryKey)

  return { javaScript: [...javaScript], styles: [...styles] }
}

const manifest = JSON.parse(await readFile(join(distDir, '.vite/manifest.json'), 'utf8'))
const entryKey = Object.keys(manifest).find(key => manifest[key].isEntry)

if (!entryKey) {
  throw new Error('No entry found in dist-web/.vite/manifest.json. Run npm run build:web first.')
}

const { javaScript: initialJs, styles: initialCss } = collectInitialPayload(manifest, entryKey)
const entryFile = manifest[entryKey].file

const allFiles = await readdir(assetsDir)
const allJs = allFiles.filter(file => file.endsWith('.js')).map(file => `assets/${file}`)

if (allJs.length === 0) {
  throw new Error('No web JavaScript assets found. Run npm run build:web first.')
}

const initialJsSet = new Set(initialJs)
const lazyJs = allJs.filter(file => !initialJsSet.has(file))

const initialJsGzip = await sumGzipBytes(initialJs)
const initialCssGzip = await sumGzipBytes(initialCss)
const totalJsGzip = await sumGzipBytes(allJs)

const lazySizes = await Promise.all(
  lazyJs.map(async file => ({ file, gzipBytes: await gzipBytesOf(file) }))
)
const largestLazy = lazySizes.sort((a, b) => b.gzipBytes - a.gzipBytes)[0]

console.log(`Entry: ${entryFile}`)
console.log(`Initial payload: ${initialJs.length} JS chunk(s), ${initialCss.length} stylesheet(s)`)
console.log('')

checkBudget('initial JS   ', initialJsGzip, maxInitialJsGzipBytes)
checkBudget('initial CSS  ', initialCssGzip, maxInitialCssGzipBytes)
checkBudget('initial total', initialJsGzip + initialCssGzip, maxInitialTotalGzipBytes)
if (largestLazy) {
  checkBudget(`largest lazy (${largestLazy.file.replace('assets/', '')})`, largestLazy.gzipBytes, maxLazyChunkGzipBytes)
}
checkBudget('total JS     ', totalJsGzip, maxTotalJsGzipBytes)
console.log('')

const html = await readFile(join(distDir, 'index.html'), 'utf8')

const moduleScripts = [...html.matchAll(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g)].map(match => match[1])
if (moduleScripts.length !== 1) {
  fail(`index.html has ${moduleScripts.length} module script tags, expected exactly 1.`)
}

const stylesheets = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)].map(match => match[1])
if (stylesheets.length === 0) {
  fail(
    'index.html has no <link rel="stylesheet">. The CSS is being injected by JavaScript at runtime, ' +
      'so the page cannot paint until the whole bundle has parsed.'
  )
}

const entryGzip = await gzipBytesOf(entryFile)
if (entryGzip < minEntryGzipBytes) {
  fail(
    `Entry chunk ${entryFile} is only ${formatKiB(entryGzip)} gzip, under the ${formatKiB(minEntryGzipBytes)} floor. ` +
      'That usually means index.html is loading a dispatcher shim instead of the real entry.'
  )
}

const headStart = html.indexOf(HEAD_START)
const headEnd = html.indexOf(HEAD_END)
if (headStart === -1 || headEnd === -1) {
  fail(`index.html is missing the ${HEAD_START} / ${HEAD_END} markers the SEO shell splices on.`)
} else if (headStart > headEnd) {
  fail(`index.html has ${HEAD_END} before ${HEAD_START}.`)
} else {
  const misplaced = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].filter(match => match.index < headEnd)
  for (const match of misplaced) {
    fail(`index.html references ${match[1]} before ${HEAD_END}; the SEO shell would discard that tag.`)
  }
}

const desktopOnlyMarkers = ['electron-updater', 'utbt-launcher-updater', 'checking-installation', 'electron.vite']
for (const file of allJs) {
  const text = await readFile(join(distDir, file), 'utf8')
  for (const marker of desktopOnlyMarkers) {
    if (text.includes(marker)) fail(`${file}: contains desktop-only marker "${marker}"`)
  }
}

if (failures.length > 0) {
  throw new Error(`Web bundle checks failed:\n - ${failures.join('\n - ')}`)
}

console.log('index.html structure, bundle budgets and desktop-only markers all OK.')
