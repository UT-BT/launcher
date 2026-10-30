import { ConveyorApi } from '@/lib/preload/shared'

export class WindowApi extends ConveyorApi {
  windowInit = () => this.invoke('window-init')
  windowMinimize = () => this.invoke('window-minimize')
  windowClose = () => this.invoke('window-close')
  windowMaximizeToggle = () => this.invoke('window-maximize-toggle')
  webOpenUrl = (url: string) => this.invoke('web-open-url', url)
}
