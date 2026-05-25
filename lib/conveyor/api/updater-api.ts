import { ConveyorApi } from '@/lib/preload/shared'

export class UpdaterApi extends ConveyorApi {
  check = (manual?: boolean) => this.invoke('updater:check', manual)
  download = () => this.invoke('updater:download')
  quitAndInstall = () => this.invoke('updater:quitAndInstall')
  getState = () => this.invoke('updater:getState')
  setAllowPrerelease = (value: boolean) => this.invoke('updater:setAllowPrerelease', value)
}
