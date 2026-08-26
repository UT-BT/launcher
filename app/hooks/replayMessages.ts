import type { ReplayState } from '@/app/utils/api'

export const REPLAY_CONVERTING_MESSAGE = 'This run is still being processed. Please try again in a few minutes.'
export const REPLAY_UNAVAILABLE_MESSAGE = 'No replay has been uploaded for this run.'
export const REPLAY_ERROR_MESSAGE = 'Could not load this replay. Please try again later.'

export function replayErrorMessage(state: Exclude<ReplayState, 'ready'>): string {
    switch (state) {
        case 'converting': return REPLAY_CONVERTING_MESSAGE
        case 'unavailable': return REPLAY_UNAVAILABLE_MESSAGE
        default: return REPLAY_ERROR_MESSAGE
    }
}
