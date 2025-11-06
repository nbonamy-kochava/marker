import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readdir, readFile, stat } from 'fs/promises'
import Store from 'electron-store'
import chokidar, { FSWatcher } from 'chokidar'
import * as pty from 'node-pty'
import { platform } from 'os'

const store = new Store()

let mainWindow: BrowserWindow | null = null
let fileWatcher: FSWatcher | null = null
let debounceTimer: NodeJS.Timeout | null = null
let ptyProcess: pty.IPty | null = null

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

// Electron-vite exposes preload scripts via VITE_DEV_SERVER_URL in dev mode
const PRELOAD_PATH = join(__dirname, '../preload/index.mjs')

async function createWindow() {
  console.log('Preload path:', PRELOAD_PATH)

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function readDirectoryRecursive(dirPath: string): Promise<FileNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)

    // Skip hidden files and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue
    }

    if (entry.isDirectory()) {
      const children = await readDirectoryRecursive(fullPath)
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: true,
        children
      })
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: false
      })
    }
  }

  // Sort: directories first, then files, alphabetically
  return nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

function notifyFolderChanged(folderPath: string) {
  // Clear existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  // Set new timer
  debounceTimer = setTimeout(() => {
    console.log('Notifying renderer of folder changes')
    mainWindow?.webContents.send('fs:folder-changed', folderPath)
    debounceTimer = null
  }, 300)
}

function startWatchingFolder(folderPath: string) {
  // Stop existing watcher if any
  stopWatchingFolder()

  console.log('Starting filesystem watcher for:', folderPath)

  fileWatcher = chokidar.watch(folderPath, {
    ignored: /(^|[/\\])\.|node_modules/, // ignore dotfiles and node_modules
    persistent: true,
    ignoreInitial: true, // don't fire events for initial scan
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 100
    }
  })

  // Any change triggers a full refresh
  fileWatcher
    .on('add', () => notifyFolderChanged(folderPath))
    .on('change', () => notifyFolderChanged(folderPath))
    .on('unlink', () => notifyFolderChanged(folderPath))
    .on('addDir', () => notifyFolderChanged(folderPath))
    .on('unlinkDir', () => notifyFolderChanged(folderPath))
    .on('error', (error) => console.error('Watcher error:', error))
}

function stopWatchingFolder() {
  if (fileWatcher) {
    console.log('Stopping filesystem watcher')
    fileWatcher.close()
    fileWatcher = null
  }

  // Clear pending timer
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

// IPC Handlers
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0]
    store.set('lastOpenedFolder', folderPath)
    startWatchingFolder(folderPath)
    return folderPath
  }

  return null
})

ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
  try {
    return await readDirectoryRecursive(dirPath)
  } catch (error) {
    console.error('Error reading directory:', error)
    throw error
  }
})

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    console.error('Error reading file:', error)
    throw error
  }
})

ipcMain.handle('store:getLastFolder', async () => {
  return store.get('lastOpenedFolder') as string | undefined
})

ipcMain.handle('fs:startWatching', async (_event, folderPath: string) => {
  startWatchingFolder(folderPath)
})

// Terminal IPC Handlers
ipcMain.handle('terminal:create', async () => {
  if (ptyProcess) {
    ptyProcess.kill()
  }

  const shell = platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'

  ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || process.cwd(),
    env: process.env as Record<string, string>
  })

  ptyProcess.onData((data) => {
    mainWindow?.webContents.send('terminal:data', data)
  })

  ptyProcess.onExit(() => {
    mainWindow?.webContents.send('terminal:exit')
  })

  return ptyProcess.pid
})

ipcMain.handle('terminal:write', async (_event, data: string) => {
  ptyProcess?.write(data)
})

ipcMain.handle('terminal:resize', async (_event, cols: number, rows: number) => {
  ptyProcess?.resize(cols, rows)
})

ipcMain.handle('terminal:sendCommand', async (_event, command: string) => {
  if (ptyProcess) {
    ptyProcess.write(command + '\r')
  }
})

// App lifecycle
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  stopWatchingFolder()
  if (ptyProcess) {
    ptyProcess.kill()
    ptyProcess = null
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
