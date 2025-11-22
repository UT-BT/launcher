import { ConveyorApi } from '@/lib/preload/shared'

export class GameApi extends ConveyorApi {
    launchGame = (ip: string, port: number, password?: string) => this.invoke('launchGame', ip, port, password)
    fetchServers = () => this.invoke('fetchServers')
}
