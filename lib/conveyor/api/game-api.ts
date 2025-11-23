import { ConveyorApi } from '@/lib/preload/shared'

export class GameApi extends ConveyorApi {
    launchGame = (ip: string, port: number, password?: string, asSpectator?: boolean) => this.invoke('launchGame', ip, port, password, asSpectator)
    fetchServers = () => this.invoke('fetchServers')
    pingServer = (ip: string) => this.invoke('pingServer', ip)
}
