export function fuzzyMatch(text: string, query: string): boolean {
    if (!query) return true
    const t = text.toLowerCase()
    const q = query.toLowerCase()
    if (t.includes(q)) return true
    let i = 0
    for (const c of t) {
        if (c === q[i]) i++
        if (i >= q.length) return true
    }
    return i >= q.length
}
