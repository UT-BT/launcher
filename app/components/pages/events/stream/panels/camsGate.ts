import type { PlatformCapabilities } from '@/app/platform/capabilities'

export type CamsPanelView = 'cam-tool' | 'web-notice'

export function camsPanelView(capabilities: PlatformCapabilities): CamsPanelView {
    return capabilities.camTool ? 'cam-tool' : 'web-notice'
}
