export interface PlatformCapabilities {
    game: boolean
    ping: boolean
    ini: boolean
    install: boolean
    updater: boolean
    desktopFiles: boolean
    windowChrome: boolean
    settingsModal: boolean
}

export const DESKTOP_CAPABILITIES: PlatformCapabilities = {
    game: true,
    ping: true,
    ini: true,
    install: true,
    updater: true,
    desktopFiles: true,
    windowChrome: true,
    settingsModal: true,
}

export const WEB_CAPABILITIES: PlatformCapabilities = {
    game: false,
    ping: false,
    ini: false,
    install: false,
    updater: false,
    desktopFiles: false,
    windowChrome: false,
    settingsModal: false,
}
