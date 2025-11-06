import WebSocket, { WebSocketServer } from 'ws'
import { randomUUID } from 'crypto'
import { mkdir, writeFile, unlink, readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { createServer } from 'net'

interface LockFile {
  pid: number
  workspaceFolders: string[]
  ideName: string
  transport: string
  authToken: string
}

interface JSONRPCRequest {
  jsonrpc: string
  method: string
  params?: any
  id?: string | number
}

interface JSONRPCResponse {
  jsonrpc: string
  id: string | number
  result?: any
  error?: {
    code: number
    message: string
  }
}

interface Selection {
  start: { line: number; character: number }
  end: { line: number; character: number }
  isEmpty: boolean
}

interface SelectionChangedParams {
  filePath: string
  fileUrl: string
  text: string
  selection: Selection
}

export class ClaudeIDEServer {
  private wss: WebSocketServer | null = null
  private port: number | null = null
  private authToken: string | null = null
  private currentFile: string | null = null
  private currentContent: string = ''
  private workspaceFolder: string | null = null
  private lockFilePath: string | null = null

  async start(workspaceFolder: string): Promise<void> {
    this.workspaceFolder = workspaceFolder

    // Generate auth token
    this.authToken = randomUUID()

    // Find available port
    this.port = await this.findAvailablePort(10000, 65535)

    // Create WebSocket server
    this.wss = new WebSocketServer({
      port: this.port,
      host: '127.0.0.1'
    })

    console.log(`Claude IDE server started on port ${this.port}`)

    // Handle connections
    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req)
    })

    // Write lock file
    await this.writeLockFile()
  }

  async stop(): Promise<void> {
    if (this.wss) {
      this.wss.close()
      this.wss = null
    }

    if (this.lockFilePath) {
      try {
        await unlink(this.lockFilePath)
      } catch (error) {
        // Ignore errors when removing lock file
      }
      this.lockFilePath = null
    }

    console.log('Claude IDE server stopped')
  }

  updateCurrentFile(filePath: string, content: string): void {
    this.currentFile = filePath
    this.currentContent = content

    // Notify all connected clients
    this.notifySelectionChanged()
  }

  private handleConnection(ws: WebSocket, req: any): void {
    // Validate auth token
    const token = req.headers['x-claude-code-ide-authorization']
    console.log('=== Incoming WebSocket connection ===')
    console.log('Auth header:', token)
    console.log('Expected token:', this.authToken)

    if (token !== this.authToken) {
      console.warn('Claude Code connection rejected: invalid auth token')
      ws.close(1008, 'Invalid auth token')
      return
    }

    console.log('✅ Claude Code connected successfully!')

    ws.on('message', (data: Buffer) => {
      try {
        const message: JSONRPCRequest = JSON.parse(data.toString())
        console.log('📩 Received message from Claude:', JSON.stringify(message, null, 2))
        this.handleMessage(ws, message)
      } catch (error) {
        console.error('Error parsing message from Claude Code:', error)
      }
    })

    ws.on('close', () => {
      console.log('❌ Claude Code disconnected')
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  }

  private handleMessage(ws: WebSocket, message: JSONRPCRequest): void {
    const { method, params, id } = message

    console.log(`Claude Code called method: ${method}`)

    switch (method) {
      case 'getCurrentSelection':
        this.handleGetCurrentSelection(ws, id)
        break

      case 'getLatestSelection':
        this.handleGetLatestSelection(ws, id)
        break

      case 'getWorkspaceFolders':
        this.handleGetWorkspaceFolders(ws, id)
        break

      case 'getOpenEditors':
        this.handleGetOpenEditors(ws, id)
        break

      default:
        this.sendError(ws, id, -32601, `Method not found: ${method}`)
    }
  }

  private handleGetCurrentSelection(ws: WebSocket, id: string | number | undefined): void {
    if (!this.currentFile) {
      this.sendResponse(ws, id, {
        content: [{
          type: 'text',
          text: JSON.stringify({
            filePath: null,
            text: ''
          })
        }]
      })
      return
    }

    this.sendResponse(ws, id, {
      content: [{
        type: 'text',
        text: JSON.stringify({
          filePath: this.currentFile,
          text: this.currentContent
        })
      }]
    })
  }

  private handleGetLatestSelection(ws: WebSocket, id: string | number | undefined): void {
    // Same as getCurrentSelection for our use case
    this.handleGetCurrentSelection(ws, id)
  }

  private handleGetWorkspaceFolders(ws: WebSocket, id: string | number | undefined): void {
    this.sendResponse(ws, id, {
      content: [{
        type: 'text',
        text: JSON.stringify({
          workspaceFolders: this.workspaceFolder ? [this.workspaceFolder] : []
        })
      }]
    })
  }

  private handleGetOpenEditors(ws: WebSocket, id: string | number | undefined): void {
    const editors = this.currentFile ? [{
      filePath: this.currentFile,
      isActive: true
    }] : []

    this.sendResponse(ws, id, {
      content: [{
        type: 'text',
        text: JSON.stringify({ editors })
      }]
    })
  }

  private notifySelectionChanged(): void {
    if (!this.wss || !this.currentFile) {
      console.log('⚠️  Cannot notify: wss =', !!this.wss, 'currentFile =', !!this.currentFile)
      return
    }

    const notification: SelectionChangedParams = {
      filePath: this.currentFile,
      fileUrl: `file://${this.currentFile}`,
      text: this.currentContent,
      selection: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
        isEmpty: true
      }
    }

    const message = {
      jsonrpc: '2.0',
      method: 'selection_changed',
      params: notification
    }

    const connectedClients = Array.from(this.wss.clients).filter(c => c.readyState === WebSocket.OPEN).length
    console.log(`📤 Sending selection_changed notification to ${connectedClients} client(s)`)
    console.log('Message:', JSON.stringify(message, null, 2))

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message))
        console.log(`✅ Notified Claude Code of file change: ${this.currentFile}`)
      }
    })
  }

  private sendResponse(ws: WebSocket, id: string | number | undefined, result: any): void {
    if (id === undefined) {
      return // Notifications don't need responses
    }

    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id,
      result
    }

    console.log('📤 Sending response:', JSON.stringify(response, null, 2))
    ws.send(JSON.stringify(response))
  }

  private sendError(ws: WebSocket, id: string | number | undefined, code: number, message: string): void {
    if (id === undefined) {
      return
    }

    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message
      }
    }

    ws.send(JSON.stringify(response))
  }

  private async findAvailablePort(min: number, max: number): Promise<number> {
    for (let port = min; port <= max; port++) {
      if (await this.isPortAvailable(port)) {
        return port
      }
      // Try a few random ports to avoid scanning too many
      if (port === min + 100) {
        port = Math.floor(Math.random() * (max - min) + min)
      }
    }
    throw new Error('No available port found')
  }

  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer()
      server.once('error', () => {
        resolve(false)
      })
      server.once('listening', () => {
        server.close()
        resolve(true)
      })
      server.listen(port, '127.0.0.1')
    })
  }

  private async writeLockFile(): Promise<void> {
    if (!this.port || !this.authToken || !this.workspaceFolder) {
      throw new Error('Cannot write lock file: server not fully initialized')
    }

    const ideDir = join(homedir(), '.claude', 'ide')
    await mkdir(ideDir, { recursive: true })

    this.lockFilePath = join(ideDir, `${this.port}.lock`)

    const lockData: LockFile = {
      pid: process.pid,
      workspaceFolders: [this.workspaceFolder],
      ideName: 'Marker',
      transport: 'ws',
      authToken: this.authToken
    }

    await writeFile(this.lockFilePath, JSON.stringify(lockData, null, 2))
    console.log(`Lock file created: ${this.lockFilePath}`)
  }
}
