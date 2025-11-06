import { contextBridge, ipcRenderer } from 'electron'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

const api = {
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  readDirectory: (path: string): Promise<FileNode[]> =>
    ipcRenderer.invoke('fs:readDirectory', path),

  readFile: (path: string): Promise<string> =>
    ipcRenderer.invoke('fs:readFile', path),

  getLastFolder: (): Promise<string | undefined> =>
    ipcRenderer.invoke('store:getLastFolder')
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
