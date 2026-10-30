import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifestPath = 'agents/verify.json'
const manifest = JSON.parse(readFileSync(join(root, manifestPath), 'utf8'))

const failures = []
const reviews = []

function fail(message) {
  failures.push(message)
}

function exists(path) {
  return existsSync(join(root, path))
}

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

function proseLines(path) {
  let inFence = false
  return readFileSync(join(root, path), 'utf8')
    .split('\n')
    .map((line) => {
      if (line.trimStart().startsWith('```')) {
        inFence = !inFence
        return ''
      }
      return inFence ? '' : line
    })
}

function slugsOf(path) {
  const seen = new Map()
  const slugs = new Set()
  for (const line of proseLines(path)) {
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)
    if (!heading) continue
    const base = heading[1]
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-')
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    slugs.add(count ? `${base}-${count}` : base)
  }
  return slugs
}

function checkLinks(path) {
  const text = proseLines(path).join('\n').replace(/`[^`\n]*`/g, '')
  for (const [, href] of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(href)) continue
    const [target, anchor] = href.split('#')
    const resolved = target ? posix.normalize(posix.join(posix.dirname(path), target)) : path
    if (!exists(resolved)) {
      fail(`${path}: broken link ${href}`)
    } else if (anchor && resolved.endsWith('.md') && !slugsOf(resolved).has(anchor)) {
      fail(`${path}: no heading for ${href}`)
    }
  }
}

function changedFiles() {
  const base = process.argv.includes('--base')
    ? process.argv[process.argv.indexOf('--base') + 1]
    : (git('merge-base', 'HEAD', 'origin/staging') ?? git('merge-base', 'HEAD', 'staging'))
  if (!base) return new Set()
  const tracked = git('diff', '--name-only', base) ?? ''
  const untracked = git('ls-files', '--others', '--exclude-standard') ?? ''
  return new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))
}

for (const [doc, sources] of Object.entries(manifest)) {
  if (!exists(doc)) fail(`${doc}: listed in ${manifestPath} but missing`)
  for (const source of sources) {
    if (!exists(source)) fail(`${doc}: verifies against missing ${source}`)
  }
}

const agentDocs = readdirSync(join(root, 'agents'), { recursive: true })
  .map((file) => posix.join('agents', file.replaceAll('\\', '/')))
  .filter((file) => file.endsWith('.md'))
for (const doc of agentDocs) {
  if (!(doc in manifest)) fail(`${doc}: not listed in ${manifestPath}`)
}

const skills = readdirSync(join(root, '.claude/skills'))
  .map((name) => `.claude/skills/${name}/SKILL.md`)
  .filter(exists)
for (const path of new Set(['CLAUDE.md', ...skills, ...agentDocs, ...Object.keys(manifest).filter(exists)])) {
  checkLinks(path)
}

const changed = changedFiles()
for (const [doc, sources] of Object.entries(manifest)) {
  const hits = sources.filter((source) => changed.has(source))
  if (hits.length && !changed.has(doc)) reviews.push(`${doc} (${hits.join(', ')})`)
}

if (reviews.length) {
  console.log('Review these docs: their sources changed on this branch but the doc did not.')
  for (const review of reviews) console.log(`  ${review}`)
}
if (failures.length) {
  console.error('Doc check failed:')
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}
if (!reviews.length) console.log('Docs OK.')
