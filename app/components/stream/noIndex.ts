export function markPageNoIndex(): void {
    const existing = [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="robots"]')]
    const tags = existing.length > 0 ? existing : [document.head.appendChild(Object.assign(document.createElement('meta'), { name: 'robots' }))]
    for (const tag of tags) tag.content = 'noindex'
}
