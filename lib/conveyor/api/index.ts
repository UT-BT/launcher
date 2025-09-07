import { electronAPI } from '@electron-toolkit/preload'
import { AppApi } from './app-api'
import { WindowApi } from './window-api'
import { LoggingApi } from './logging-api'

export const conveyor = {
  electron: electronAPI,
  app: new AppApi(electronAPI),
  window: new WindowApi(electronAPI),
  logging: new LoggingApi(electronAPI),
}

export type ConveyorApi = typeof conveyor
