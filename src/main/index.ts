import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readdir, readFile, stat } from 'fs/promises'
import Store from 'electron-store'
import chokidar, { FSWatcher } from 'chokidar'
import * as pty from 'node-pty'
import { platform } from 'os'
import { ClaudeIDEServer } from './claudeIDE'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const store = new Store()

let mainWindow: BrowserWindow | null = null
let fileWatcher: FSWatcher | null = null
let debounceTimer: NodeJS.Timeout | null = null
let ptyProcess: pty.IPty | null = null
let claudeIDEServer: ClaudeIDEServer | null = null

interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked'
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

async function getGitStatus(repoPath: string): Promise<Map<string, string>> {
  const statusMap = new Map<string, string>()

  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: repoPath })
    const lines = stdout.split('\n').filter(line => line.trim())

    for (const line of lines) {
      const status = line.substring(0, 2)
      const filePath = line.substring(3)
      const fullPath = join(repoPath, filePath)

      if (status === ' M' || status === 'M ' || status === 'MM') {
        statusMap.set(fullPath, 'modified')
      } else if (status === 'A ' || status === 'AM') {
        statusMap.set(fullPath, 'added')
      } else if (status === ' D' || status === 'D ') {
        statusMap.set(fullPath, 'deleted')
      } else if (status === '??') {
        statusMap.set(fullPath, 'untracked')
      }
    }
  } catch (error) {
    // Not a git repo or git not available
    console.log('Git status unavailable:', error)
  }

  return statusMap
}

async function readDirectoryRecursive(dirPath: string, gitStatusMap?: Map<string, string>): Promise<FileNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)

    // Skip hidden files and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue
    }

    if (entry.isDirectory()) {
      const children = await readDirectoryRecursive(fullPath, gitStatusMap)
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: true,
        children
      })
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.markdown')) {
      const gitStatus = gitStatusMap?.get(fullPath) as any
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: false,
        gitStatus
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

    // Start Claude IDE server for this workspace
    if (claudeIDEServer) {
      await claudeIDEServer.stop()
    }
    claudeIDEServer = new ClaudeIDEServer()
    await claudeIDEServer.start(folderPath)

    return folderPath
  }

  return null
})

ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
  try {
    const gitStatusMap = await getGitStatus(dirPath)
    return await readDirectoryRecursive(dirPath, gitStatusMap)
  } catch (error) {
    console.error('Error reading directory:', error)
    throw error
  }
})

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')

    // Notify Claude IDE server of the file change
    if (claudeIDEServer) {
      claudeIDEServer.updateCurrentFile(filePath, content)
    }

    return content
  } catch (error) {
    console.error('Error reading file:', error)
    throw error
  }
})

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  try {
    await writeFile(filePath, content, 'utf-8')

    // Notify Claude IDE server of the file change
    if (claudeIDEServer) {
      claudeIDEServer.updateCurrentFile(filePath, content)
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error writing file:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('store:getLastFolder', async () => {
  return store.get('lastOpenedFolder') as string | undefined
})

ipcMain.handle('fs:startWatching', async (_event, folderPath: string) => {
  startWatchingFolder(folderPath)

  // Start Claude IDE server for this workspace if not already started
  if (!claudeIDEServer && folderPath) {
    claudeIDEServer = new ClaudeIDEServer()
    await claudeIDEServer.start(folderPath)
  }
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

// Git IPC Handlers
ipcMain.handle('git:getStatus', async (_event, repoPath: string) => {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: repoPath })
    const files: Array<{ path: string; status: string }> = []

    const lines = stdout.split('\n').filter(line => line.trim())
    for (const line of lines) {
      const status = line.substring(0, 2).trim()
      const filePath = line.substring(3)

      files.push({
        path: filePath,
        status: status === 'M' || status === 'MM' ? 'modified' :
                status === 'A' || status === 'AM' ? 'added' :
                status === 'D' ? 'deleted' :
                status === '??' ? 'untracked' : 'unknown'
      })
    }

    return files
  } catch (error) {
    console.error('Error getting git status:', error)
    return []
  }
})

ipcMain.handle('git:commit', async (_event, repoPath: string, message: string) => {
  try {
    await execAsync('git add .', { cwd: repoPath })
    await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: repoPath })
    return { success: true }
  } catch (error: any) {
    console.error('Error committing:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('git:push', async (_event, repoPath: string) => {
  try {
    await execAsync('git push', { cwd: repoPath })
    return { success: true }
  } catch (error: any) {
    console.error('Error pushing:', error)
    return { success: false, error: error.message }
  }
})

// App lifecycle
app.whenReady().then(createWindow)

app.on('window-all-closed', async () => {
  stopWatchingFolder()
  if (ptyProcess) {
    ptyProcess.kill()
    ptyProcess = null
  }
  if (claudeIDEServer) {
    await claudeIDEServer.stop()
    claudeIDEServer = null
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
