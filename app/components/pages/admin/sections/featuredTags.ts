export const FEATURED_TAGS_MAX = 128
export const FEATURED_SUGGESTION_LIMIT = 8

function keyOf(tag: string): string {
  return tag.trim().toLowerCase()
}

function isFeatured(featured: string[], tag: string): boolean {
  const key = keyOf(tag)
  return featured.some((item) => keyOf(item) === key)
}

export function moveTag(tags: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= tags.length || to >= tags.length) return tags
  const next = [...tags]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index])
}

export function addableTags(available: string[], featured: string[]): string[] {
  return available.filter((tag) => !isFeatured(featured, tag))
}

export function tagSuggestions(
  available: string[],
  featured: string[],
  query: string,
  limit = FEATURED_SUGGESTION_LIMIT
): string[] {
  const q = keyOf(query)
  if (!q) return []
  const candidates = addableTags(available, featured).filter((tag) => tag.toLowerCase().includes(q))
  const prefixed = candidates.filter((tag) => tag.toLowerCase().startsWith(q))
  const inside = candidates.filter((tag) => !tag.toLowerCase().startsWith(q))
  return [...prefixed, ...inside].slice(0, limit)
}

export function pickTag(available: string[], featured: string[], query: string): string | null {
  const typed = query.trim()
  if (!typed) return null
  const addable = addableTags(available, featured)
  const exact = addable.find((tag) => tag === typed) ?? addable.find((tag) => keyOf(tag) === keyOf(typed))
  if (exact) return exact
  const suggestions = tagSuggestions(available, featured, typed)
  return suggestions.length === 1 ? suggestions[0] : null
}

export function tagsWithoutActiveMap(featured: string[], available: string[]): Set<string> {
  const carried = new Set(available.map(keyOf))
  return new Set(featured.filter((tag) => !carried.has(keyOf(tag))))
}
