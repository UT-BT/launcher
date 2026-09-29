const FAILURE_MESSAGES: Record<string, string> = {
    'unsupported-platform': 'Extracting the kit works on Windows only.',
    empty: 'Enter the folder you keep the kit in.',
    'not-absolute': 'Use a full Windows path that starts with a drive.',
    traversal: "The path can't contain .. folders.",
    'invalid-characters': "The path has characters Windows doesn't allow.",
    'drive-root': 'Pick a folder, not a whole drive.',
    'invalid-url': 'The kit address was refused.',
    'missing-token': 'Sign in again, then retry.',
    unauthorized: 'Your sign-in expired. Sign in again, then retry.',
    forbidden: "You can't download this streamer's kit.",
    'not-found': "The kit wasn't found for this event or streamer.",
    'download-failed': 'The download failed. Check your connection and retry.',
    'too-large': 'The kit is larger than expected, so it was refused.',
    'invalid-zip': "The download wasn't a valid ZIP.",
    'zip-slip': 'The kit contained unsafe file paths, so nothing was extracted.',
    'extract-error': 'Extracting into the folder failed. Check it is writable.',
}

export function kitExtractFailureMessage(reason: string): string {
    return FAILURE_MESSAGES[reason] ?? 'The kit could not be extracted.'
}
