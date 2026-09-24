export function isStreamSoundMuted(search: string): boolean {
    return new URLSearchParams(search).get('sound') === '0'
}
