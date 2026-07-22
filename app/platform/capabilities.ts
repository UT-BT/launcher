export interface PlatformCapabilities {
    game: boolean
    ping: boolean
    ini: boolean
    install: boolean
    updater: boolean
    desktopFiles: boolean
    windowChrome: boolean
    settingsModal: boolean
    anonymousBrowse: boolean
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
    anonymousBrowse: false,
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
    anonymousBrowse: true,
}
