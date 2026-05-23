import { ConveyorApi } from '@/lib/preload/shared'

export class FavoritesApi extends ConveyorApi {
    writeIni = (mapNames: string[]) => this.invoke('writeFavoritesIni', mapNames)
    readIni = () => this.invoke('readFavoritesIni')
}
