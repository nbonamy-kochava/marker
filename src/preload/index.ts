import { contextBridge, ipcRenderer } from 'electron'

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked'
  children?: FileNode[]
}

const api = {
  openFolder: (): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openFolder'),

  readDirectory: (path: string): Promise<FileNode[]> =>
    ipcRenderer.invoke('fs:readDirectory', path),

  readFile: (path: string): Promise<string> =>
    ipcRenderer.invoke('fs:readFile', path),

  writeFile: (path: string, content: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('fs:writeFile', path, content),

  getLastFolder: (): Promise<string | undefined> =>
    ipcRenderer.invoke('store:getLastFolder'),

  startWatching: (path: string): Promise<void> =>
    ipcRenderer.invoke('fs:startWatching', path),

  onFolderChanged: (callback: (folderPath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, folderPath: string) => callback(folderPath)
    ipcRenderer.on('fs:folder-changed', listener)
    return () => ipcRenderer.removeListener('fs:folder-changed', listener)
  },

  // Terminal API
  terminal: {
    create: (): Promise<number> =>
      ipcRenderer.invoke('terminal:create'),

    write: (data: string): Promise<void> =>
      ipcRenderer.invoke('terminal:write', data),

    resize: (cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke('terminal:resize', cols, rows),

    sendCommand: (command: string): Promise<void> =>
      ipcRenderer.invoke('terminal:sendCommand', command),

    onData: (callback: (data: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, data: string) => callback(data)
      ipcRenderer.on('terminal:data', listener)
      return () => ipcRenderer.removeListener('terminal:data', listener)
    },

    onExit: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    }
  },

  // Git API
  git: {
    getStatus: (repoPath: string): Promise<Array<{ path: string; status: string }>> =>
      ipcRenderer.invoke('git:getStatus', repoPath),

    commit: (repoPath: string, message: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('git:commit', repoPath, message),

    push: (repoPath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('git:push', repoPath)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
