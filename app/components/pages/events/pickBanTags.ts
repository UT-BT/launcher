export function tagKey(tag: string): string {
    return tag.trim().toLowerCase()
}

export function sameTag(a: string, b: string): boolean {
    return tagKey(a) === tagKey(b)
}
