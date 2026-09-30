export const ROSTER_EMPTY_TEXT = 'No streamers on the roster yet. Staff add them in Admin → Streamers.'
export const ROSTER_FAILED_TEXT = 'The streamer roster could not be loaded.'

export function streamerListNote(failed: boolean, loading: boolean): string {
    if (failed) return ROSTER_FAILED_TEXT
    if (loading) return 'Loading streamers…'
    return ROSTER_EMPTY_TEXT
}
