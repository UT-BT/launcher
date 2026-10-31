const COUNT_WORDS = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
]

export function countWord(count: number): string {
    return count >= 1 && count < COUNT_WORDS.length ? COUNT_WORDS[count] : String(count)
}

export function joinWithAnd(items: readonly string[]): string {
    if (items.length < 2) return items.join('')
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}
