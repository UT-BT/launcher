const IPC_WRAPPER = /^Error invoking remote method '[^']+': (?:\w*Error: )?/
const FALLBACK_MESSAGE = 'The profile action failed.'

export async function runProfileAction(action: () => Promise<unknown>): Promise<string | null> {
    try {
        await action()
        return null
    } catch (error) {
        console.error('Game profile action failed:', error)
        const message = error instanceof Error ? error.message.replace(IPC_WRAPPER, '') : ''
        return message || FALLBACK_MESSAGE
    }
}
