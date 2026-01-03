import type { ServerConfig, ClientMessage, ServerMessage, GlobalConfig } from './@types/types.js'
import { WebSocketServer, WebSocket } from 'ws'
import { initLogger } from './utils/logger.js'
import chokidar, { FSWatcher } from 'chokidar'
import injectScript from './script.js'
import { exec } from 'child_process'
import express from 'express'
import http from 'http'
import path from 'path'
import cors from 'cors'
import net from 'net'
import fs from 'fs'

const injectScript_str = `<script>(${injectScript.toString()})();</script>`

export class DevServer {
  readonly config: Required<ServerConfig>
  readonly port: number
  private app: express.Application
  private server: http.Server
  private wss: WebSocketServer
  private watcher: FSWatcher | null = null;
  private clients: Set<WebSocket> = new Set();

  constructor(config: ServerConfig) {
    // 处理配置
    this.config = {
      port: config.port || 6251,
      openBrowser: config.openBrowser ?? true,
      cors: config.cors ?? true,
      fullReload: config.fullReload ?? false,
      staticDirs: config.staticDirs?.map(p => path.resolve(process.cwd(), p)) || [],
      htmlPath: path.resolve(process.cwd(), config.htmlPath),
      watchPaths: config.watchPaths.map(p => path.resolve(process.cwd(), p)),
      removeSrcPrefix: config.removeSrcPrefix || []
    }
    this.port = this.config.port
    logger.debug(`[${logger.magenta(this.port)}] Server configuration:`, this.config)
    logger.info(`[${logger.magenta(this.port)}] 目标文件：${this.config.htmlPath}`)

    this.app = express()
    this.server = http.createServer(this.app)
    this.wss = new WebSocketServer({ server: this.server })

    this.setupHttpServer()
    this.setupWebSocket()
    this.setupFileWatcher()
  }

  private setupHttpServer(): void {
    // CORS
    if (this.config.cors) {
      this.app.use(cors())
    }
    // 设置静态文件中间件（处理其他资源）
    const allStaticDirs = [
      path.dirname(this.config.htmlPath),
      ...this.config.staticDirs
    ]
    this.app.get('/', (req, res) => {
      // logger.info(`[${logger.magenta(this.port)}] ${req.method} ${req.path}`)
      this.serveHtmlFile(res)
    })
    this.app.get('/favicon.ico', (req, res) => {
      res.status(204).end()
    })
    this.app.get('*', (req, res, next) => {
      // logger.info(`[${logger.magenta(this.port)}] ${req.method} ${req.path}`)
      // 如果有文件扩展名，可能是静态文件，交给下一个中间件处理
      if (req.path.includes('.') && !req.path.endsWith('.html')) {
        return next()
      }
      // 否则返回HTML
      this.serveHtmlFile(res)
    })
    const uniqueDirs = Array.from(new Set(allStaticDirs))
    uniqueDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.app.use(express.static(dir))
        logger.info(`[${logger.magenta(this.port)}] 静态资源：${dir}`)
      } else {
        logger.warn(`[${logger.magenta(this.port)}] 静态资源不存在：${dir}`)
      }
    })
  }

  get url() {
    return `http://localhost:${this.config.port}`
  }

  private serveHtmlFile(res: express.Response): void {
    try {
      const htmlContent = fs.readFileSync(this.config.htmlPath, 'utf-8')
      const injectedHtml = this.injectAutoReloadScript(htmlContent)
      // 禁用缓存
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(injectedHtml)
      logger.info(`[${logger.magenta(this.port)}] 发送目标页面：${this.config.htmlPath}`)
    } catch (error) {
      res.status(500).send(`...`)
    }
  }

  private injectAutoReloadScript(html: string): string {
    if (this.config.removeSrcPrefix.length) {
      html = html.replace(/(src|href)=["']([^"']+)["']/g, (match, p1, p2) => {
        let modifiedPath = p2
        this.config.removeSrcPrefix.forEach(prefix => {
          if (modifiedPath.startsWith(prefix)) {
            modifiedPath = modifiedPath.slice(prefix.length)
          }
        })
        return `${p1}="${modifiedPath}"`
      })
    }
    // 尝试在</body>前注入
    if (html.includes('</body>')) {
      return html.replace('</body>', injectScript_str + '\n</body>')
    }
    // 尝试在</head>前注入
    if (html.includes('</head>')) {
      return html.replace('</head>', injectScript_str + '\n</head>')
    }
    // 如果都没有，直接追加到最后
    return html + injectScript_str
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws)
      logger.info(`[${logger.magenta(this.port)}] ws成功连接，当前连接数：${this.clients.size}`)
      const welcomeMsg: ServerMessage = { type: 'CONNECTED', timestamp: Date.now() }
      ws.send(JSON.stringify(welcomeMsg))
      ws.on('message', (data: Buffer) => {
        try {
          const message: ClientMessage = JSON.parse(data.toString())
          this.handleClientMessage(ws, message)
        } catch (error) {
          logger.error(`[${logger.magenta(this.port)}] Error parsing client message: ${error}`)
        }
      })
      ws.on('close', () => {
        this.clients.delete(ws)
        logger.info(`[${logger.magenta(this.port)}] ws断开连接，当前连接数：${this.clients.size}`)
      })
      ws.on('error', (error) => {
        logger.error(`[${logger.magenta(this.port)}] WebSocket error: ${error}`)
      })
    })
  }

  private handleClientMessage(ws: WebSocket, message: ClientMessage): void {
    switch (message.type) {
      case 'HELLO':
        const welcomeMsg: ServerMessage = {
          type: 'WELCOME',
          timestamp: Date.now(),
          data: { version: '1.0' }
        }
        ws.send(JSON.stringify(welcomeMsg))
        break
      case 'PING':
        const pongMsg: ServerMessage = {
          type: 'PONG',
          timestamp: Date.now()
        }
        ws.send(JSON.stringify(pongMsg))
        break
      case 'VISIBLE':
        logger.info(`[${logger.magenta(this.port)}] Client became visible`, 'info')
        break
      default:
        logger.warn(`[${logger.magenta(this.port)}] Unknown message type: ${message.type}`)
    }
  }

  private setupFileWatcher(): void {
    try {
      this.watcher = chokidar.watch(this.config.watchPaths, {
        ignored: /(^|[\/\\])\../, // 忽略隐藏文件
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 100
        }
      })
      this.watcher
        .on('add', (filePath: string) => this.handleFileChange('add', filePath))
        .on('change', (filePath: string) => this.handleFileChange('change', filePath))
        .on('unlink', (filePath: string) => this.handleFileChange('unlink', filePath))
        .on('error', (error) => logger.error(`[${logger.magenta(this.port)}] Watcher error: ${error}`))

      logger.info(`[${logger.magenta(this.port)}] 监听文件：${this.config.watchPaths.join(', ')}`)
    } catch (error) {
      logger.error(`[${logger.magenta(this.port)}] 监听文件错误：${error}`)
    }
  }

  private handleFileChange(event: string, filePath: string): void {
    logger.info(`[${logger.magenta(this.port)}] 文件${event}：${filePath}`)
    // 发送刷新指令给所有客户端
    const message: ServerMessage = {
      type: 'RELOAD',
      timestamp: Date.now(),
      data: { filePath, event }
    }
    if (!this.config.fullReload) {
      // 获取文件扩展名
      const ext = path.extname(filePath).toLowerCase().slice(1)
      // 计算相对路径（用于客户端匹配）
      const relativePath = this.getRelativePath(filePath)
      message.data = {
        filePath: relativePath,
        event,
        extension: ext
      }
      // 根据文件类型发送不同的消息
      switch (ext) {
        case 'css':
          message.type = 'REFRESH_CSS'
          break
        case 'js':
          message.type = 'REFRESH_JS'
          break
        default:
          message.type = 'FILE_CHANGED'
      }
    }
    logger.debug(`[${logger.magenta(this.port)}] Broadcast message:`, message)
    this.broadcast(message)
  }

  private getRelativePath(filePath: string): string {
    // 尝试找到文件相对于静态目录的路径
    const allStaticDirs = [
      path.dirname(this.config.htmlPath),
      ...(this.config.staticDirs || [])
    ]
    for (const dir of allStaticDirs) {
      if (filePath.startsWith(dir)) {
        const relative = path.relative(dir, filePath)
        return relative.replace(/\\/g, '/')
      }
    }
    return path.basename(filePath)
  }

  private broadcast(message: ServerMessage): void {
    const data = JSON.stringify(message)
    let sentCount = 0
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
        sentCount++
      }
    })
    logger.info(`[${logger.magenta(this.port)}] 广播${message.type}消息到${sentCount}个客户端`)
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, () => {
        logger.info(`[${logger.magenta(this.port)}] 开发服务已启动：${this.url}`)
        // 自动打开浏览器
        if (this.config.openBrowser) {
          this.openBrowser(this.url)
        }
        resolve()
      })
      this.server.on('error', (error) => {
        reject(error)
      })
    })
  }

  public openBrowser(url: string = this.url): void {
    if (this.wss.clients.size > 0 && Array.from(this.wss.clients).some(client => client.readyState === WebSocket.OPEN)) {
      // 已有客户端连接，跳过自动打开浏览器
      return
    }
    const platform = process.platform
    let command: string
    switch (platform) {
      case 'darwin':
        command = `open "${url}"`
        break
      case 'win32':
        command = `start "" "${url}"`
        break
      default:
        command = `xdg-open "${url}"`
    }
    exec(command, (error) => {
      if (error) {
        logger.warn(`[${logger.magenta(this.port)}] Failed to open browser: ${error.message}`)
      }
    })
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.watcher) {
        this.watcher.close()
      }
      this.clients.forEach(client => client.close())
      this.wss.close()
      this.server.close(() => {
        logger.info(`[${logger.magenta(this.port)}] Server stopped`)
        resolve()
      })
    })
  }
}

/**
 * 检查端口是否可用
 */
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
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

/**
 * 自动管理DevServer服务
 */
export class DevServerManager {
  readonly servers: Map<string, DevServer> = new Map()
  readonly globalConfig: GlobalConfig = {}
  private portCounter: number

  constructor(globalConfig: GlobalConfig = {}) {
    this.globalConfig = globalConfig
    this.portCounter = globalConfig.startPort || 6251
  }

  /**
   * 启动一个 DevServer 实例
   * @param config 服务器配置
   * @returns 返回启动的 DevServer 实例
   */
  async start(config: ServerConfig): Promise<DevServer> {
    // 如果指定了端口，检查是否可用
    if (config.port) {
      const available = await isPortAvailable(config.port)
      if (!available) {
        throw new Error(`Port ${config.port} is already in use`)
      }
    } else {
      // 未指定端口，从startPort开始查找可用端口
      let port = this.portCounter
      let attempts = 0
      const maxAttempts = 100
      while (!(await isPortAvailable(port))) {
        port++
        attempts++
        if (attempts >= maxAttempts) {
          throw new Error(`No available port found since ${this.portCounter} after ${maxAttempts} attempts`)
        }
      }
      config = { ...config, port }
      this.portCounter = port + 1
    }
    // 创建并启动DevServer
    const server = new DevServer(config)
    await server.start()
    // 存储服务器实例，以端口为键
    this.servers.set(config.port!.toString(), server)
    return server
  }

  /**
   * 停止指定端口的服务器
   * @param port 端口号
   */
  async stop(port: number): Promise<void> {
    const key = port.toString()
    const server = this.servers.get(key)
    if (server) {
      await server.stop()
      this.servers.delete(key)
      logger.info(`Server on port ${port} stopped`)
    }
  }

  /**
   * 停止所有服务器
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.servers.values()).map(server => server.stop())
    await Promise.all(stopPromises)
    this.servers.clear()
    logger.info('All servers stopped')
  }

  /**
   * 获取所有运行中的服务器
   * @returns 服务器列表
   */
  getServers(): DevServer[] {
    return Array.from(this.servers.values())
  }

  /**
   * 打开指定端口服务器的浏览器
   * @param port 端口号
   */
  openBrowser(port: number): void {
    const server = this.getServer(port)
    if (server) {
      server.openBrowser(server.url)
    }
  }

  /**
   * 获取指定端口的服务器
   * @param port 端口号
   * @returns 服务器实例或 undefined
   */
  getServer(port: number): DevServer | undefined {
    return this.servers.get(port.toString())
  }

  /**
   * 检查指定端口的服务器是否存在
   * @param port 端口号
   * @returns 是否存在
   */
  hasServer(port: number): boolean {
    return this.servers.has(port.toString())
  }
}

// 解析命令行参数
function parseArgs(): ServerConfig & GlobalConfig {
  const args = process.argv.slice(2)
  const config: ServerConfig & GlobalConfig = {
    htmlPath: '',
    watchPaths: [],
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=')
      switch (key) {
        case 'port':
          config.port = parseInt(value || '6251')
          break
        case 'open-browser':
          config.openBrowser = value !== 'false'
          break
        case 'cors':
          config.cors = value !== 'false'
          break
        case 'full-reload':
          config.fullReload = value !== 'false'
          break
        case 'static-dirs':
          config.staticDirs = (value || '').split(',').map(p => p.trim())
          break
        case 'remove-src-prefix':
          config.removeSrcPrefix = (value || '').split(',').map(p => p.trim()).filter(p => p.length > 0)
          break
        case 'log-level':
          config.logLevel = value as any
          break
        case 'log-num-backups':
          config.logNumBackups = parseInt(value || '30') || 30
          break
        case 'start-port':
          config.startPort = parseInt(value || '6251')
          break
      }
    } else if (i === 0) {
      config.htmlPath = arg
    } else {
      config.watchPaths.push(arg)
    }
  }
  if (config.watchPaths.length === 0 && config.htmlPath) {
    // 未指定监听文件时默认监听HTML文件本身
    config.watchPaths.push(config.htmlPath)
  }
  return config
}

// 直接运行时启动服务器
if (import.meta.main) {
  const config = parseArgs()
  if (!config.htmlPath || config.watchPaths.length === 0) {
    console.error('Usage:')
    console.error('  node . <html-file> [watch-paths...] [options]')
    console.error('')
    console.error('Options:')
    console.error('  --port=6251                Server port')
    console.error('  --open-browser=true        Open browser automatically')
    console.error('  --cors=true                Enable CORS')
    console.error('  --full-reload=true         Enable full page reload on file changes')
    console.error('  --static-dirs=dir1,dir2    Additional static directories')
    console.error('  --remove-src-prefix=p1,p2  Prefixes to remove from resource paths in HTML')
    console.error('  --start-port=6251          Start port for auto-increment')
    console.error('  --log-level=info           Log level (trace, debug, info, warn, error, fatal, mark)')
    console.error('  --log-num-backups=30       Number of days to keep log files')
    console.error('')
    console.error('Example:')
    console.error('  node . example/index.html example --log-level=debug --port=6251')
    process.exit(1)
  }
  initLogger('DevServer', config)
  // 使用 DevServerManager 启动服务器
  const manager = new DevServerManager(config)
  manager.start(config).catch(error => {
    (global.logger || console).error('Failed to start server:', error)
    process.exit(1)
  })
  process.on('SIGINT', async () => {
    (global.logger || console).info('Shutting down server...')
    await manager.stopAll()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    await manager.stopAll()
    process.exit(0)
  })
} else {
  if (!global.logger) {
    initLogger('DevServer')
  }
}

export default DevServerManager