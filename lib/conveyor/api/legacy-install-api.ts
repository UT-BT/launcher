import { ConveyorApi } from '@/lib/preload/shared'

export class LegacyInstallApi extends ConveyorApi {
  getStatus = () => this.invoke('legacyInstall:getStatus')
  dismiss = () => this.invoke('legacyInstall:dismiss')
  remove = () => this.invoke('legacyInstall:remove')
}
