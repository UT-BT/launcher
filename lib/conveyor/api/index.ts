import { electronAPI } from '@electron-toolkit/preload'
import { AppApi } from './app-api'
import { WindowApi } from './window-api'
import { LoggingApi } from './logging-api'
import { GameApi } from './game-api'
import { IniApi } from './ini-api'
import { FavoritesApi } from './favorites-api'

export const conveyor = {
  electron: electronAPI,
  app: new AppApi(electronAPI),
  window: new WindowApi(electronAPI),
  logging: new LoggingApi(electronAPI),
  game: new GameApi(electronAPI),
  ini: new IniApi(electronAPI),
  favorites: new FavoritesApi(electronAPI),
}

export type ConveyorApi = typeof conveyor
