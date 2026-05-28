import { resolve, sep } from 'path'

function normalizeForCompare(p: string): string {
  return process.platform === 'win32' ? p.toLowerCase() : p
}

/**
 * Resolve `target` against `baseDir` and guarantee the result stays inside
 * `baseDir`. Absolute paths and `..` traversal that escape the base throw.
 * Returns the resolved absolute path.
 */
export function resolveWithin(baseDir: string, target: string): string {
  const base = resolve(baseDir)
  const resolved = resolve(base, target)
  const b = normalizeForCompare(base)
  const r = normalizeForCompare(resolved)
  if (r !== b && !r.startsWith(b + sep)) {
    throw new Error('Path escapes the allowed directory')
  }
  return resolved
}

/** True if `candidate` resolves to a location inside `baseDir`. */
export function isWithin(baseDir: string, candidate: string): boolean {
  const base = normalizeForCompare(resolve(baseDir))
  const resolved = normalizeForCompare(resolve(candidate))
  return resolved === base || resolved.startsWith(base + sep)
}
