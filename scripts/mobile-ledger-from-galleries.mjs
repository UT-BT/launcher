import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const OBSERVATIONS = 'observations.json'

const commonJsDirname = {
  name: 'commonjs-dirname',
  transform(code, id) {
    if (code.includes('__dirname')) return code.replace(/\b__dirname\b/g, JSON.stringify(dirname(id)))
  },
}

async function load(path) {
  const { module } = await runnerImport(join(root, path), {
    root,
    configFile: false,
    logLevel: 'error',
    plugins: [commonJsDirname],
  })
  return module
}

function observationFiles(path) {
  if (statSync(path).isFile()) return [path]
  return readdirSync(path, { recursive: true })
    .filter(entry => basename(entry) === OBSERVATIONS)
    .map(entry => join(path, entry))
}

const folders = process.argv.slice(2)
if (!folders.length) {
  console.error('Usage: npm run test:mobile:ledger:galleries -- <gallery folder or observations.json> ...')
  process.exit(1)
}
const files = folders.flatMap(observationFiles)
if (!files.length) {
  console.error(`No ${OBSERVATIONS} under ${folders.join(', ')}.`)
  process.exit(1)
}

const { LEDGER_DIR, readLedger, regenerateLedger, writeLedger } = await load('e2e/mobile/ledger.ts')
const { RULE_IDS } = await load('e2e/mobile/rules/ids.ts')
const observations = files.flatMap(file => JSON.parse(readFileSync(file, 'utf8')))
writeLedger(LEDGER_DIR, regenerateLedger(readLedger(LEDGER_DIR, RULE_IDS), RULE_IDS, observations))
console.log(`Ledger rewritten from ${observations.length} rule results in ${files.length} galleries, ${relative(root, LEDGER_DIR)}`)
