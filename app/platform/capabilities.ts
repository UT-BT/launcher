export interface PlatformCapabilities {
    game: boolean
    ping: boolean
    ini: boolean
    install: boolean
    updater: boolean
    settingsModal: boolean
    anonymousBrowse: boolean
    camTool: boolean
    desktopPromo: boolean
    overlayHistory: boolean
}

export const DESKTOP_CAPABILITIES: PlatformCapabilities = {
    game: true,
    ping: true,
    ini: true,
    install: true,
    updater: true,
    settingsModal: true,
    anonymousBrowse: false,
    camTool: true,
    desktopPromo: false,
    overlayHistory: false,
}

export const WEB_CAPABILITIES: PlatformCapabilities = {
    game: false,
    ping: false,
    ini: false,
    install: false,
    updater: false,
    settingsModal: true,
    anonymousBrowse: true,
    camTool: false,
    desktopPromo: true,
    overlayHistory: true,
}
