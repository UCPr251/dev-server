/**
 * 全局配置
 */
export interface GlobalConfig {
  /**
   * 服务器起始端口号
   * @default 6251
   */
  startPort?: number

  /**
   * 日志输出级别
   * @default 'info'
   */
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'mark'

  /**
   * 日志文件保留天数
   * @default 30
   */
  logNumBackups?: number
}

/**
 * 开发服务器配置接口
 */
export interface ServerConfig {
  /**
   * 目标HTML文件路径
   * @example './public/index.html'
   */
  htmlPath: string

  /**
   * 需要监听变化的文件或文件夹路径数组
   * @description 当这些路径下的文件发生变化时，会触发页面自动刷新
   * @example ['./src/', './public/']
   */
  watchPaths: string[]

  /**
   * 服务器监听的端口号，未指定时根据全局配置中的startPort自增
   * @default 6251
   */
  port?: number

  /**
   * 是否在启动时自动打开浏览器
   * @default true
   */
  openBrowser?: boolean

  /**
   * 额外的静态资源目录数组
   * @description 除了HTML文件所在目录外，额外需要提供静态文件服务的目录
   * @example ['./assets/', './images/']
   */
  staticDirs?: string[]

  /**
   * 是否启用CORS（跨域资源共享）
   * @description 启用后允许跨域请求，适用于开发环境
   * @default true
   */
  cors?: boolean

  /**
   * 是否在文件变化时进行完整页面刷新
   * @description 启用后，当监视的文件发生变化时，浏览器将进行完整页面刷新，而不是局部更新
   * @default false
   */
  fullReload?: boolean

  /**
   * 需要从目标html中的资源路径中移除的前缀
   * @description 修改文件访问路径，如将绝对路径转换为相对路径
   * @example ['public/']
   */
  removeSrcPrefix?: string[]

}

export interface ClientMessage {
  type: 'PING' | 'LOG' | 'HELLO' | 'VISIBLE'
  timestamp?: number
  data?: any
}

export interface ServerMessage {
  type: 'WELCOME' | 'RELOAD' | 'PONG' | 'CONNECTED' | 'ERROR' | 'FILE_CHANGED' | 'REFRESH_CSS' | 'REFRESH_JS'
  timestamp: number
  data?: any
}