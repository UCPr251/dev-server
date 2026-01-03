import type chalk from 'chalk'
import { Chalk } from 'chalk'
import log4js from 'log4js'

declare global {
  var logger: {
    logout: ((log: string) => void)[]
    get level(): string
    set level(level: string)
    chalk: typeof chalk
    red: typeof chalk
    yellow: typeof chalk
    blue: typeof chalk
    magenta: typeof chalk
    green: typeof chalk
    trace: (...args: any[]) => void
    info: (...args: any[]) => void
    debug: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
    mark: (...args: any[]) => void
  }
}

function myCustomAppender(_: any, layout: any) {
  return function (logEvent: any) {
    if (logger.logout.length === 0) return
    const formattedMessage = layout(logEvent)
    logger.logout.forEach(fnc => fnc(formattedMessage))
  }
}

myCustomAppender.configure = function (config: any, layouts: any) {
  return myCustomAppender(config, layouts.layout(config.layout.type, config.layout))
}

export function initLogger(
  APP_NAME: string,
  config: {
    logLevel?: string
    logNumBackups?: number
  } = {}
) {
  log4js.configure({
    appenders: {
      console: {
        type: 'console',
        layout: {
          type: 'pattern',
          pattern: `%[[${APP_NAME}][%d{hh:mm:ss.SSS}][%4.4p]%] %m`
        }
      },
      custom: {
        type: myCustomAppender,
        layout: {
          type: 'pattern',
          pattern: '%[[%d{hh:mm:ss.SSS}][%4.4p]%] %m',
          tokens: {
            color: true
          }
        }
      },
      message: {
        type: 'dateFile',
        filename: 'logs/message',
        pattern: 'yyyy-MM-dd.log',
        numBackups: config.logNumBackups || 30,
        alwaysIncludePattern: true,
        layout: {
          type: 'pattern',
          pattern: '[%d{hh:mm:ss.SSS}][%4.4p] %m'
        }
      },
      error: {
        type: 'file',
        filename: 'logs/error.log',
        alwaysIncludePattern: true,
        layout: {
          type: 'pattern',
          pattern: '[%d{yyyy-MM-dd hh:mm:ss.SSS}][%4.4p] %m'
        }
      }
    },
    categories: {
      default: { appenders: ['console', 'custom', 'message'], level: config.logLevel || 'info' },
      message: { appenders: ['console', 'custom', 'message'], level: 'mark' },
      error: { appenders: ['console', 'custom', 'message', 'error'], level: 'warn' },
    }
  })

  const defaultLogger = log4js.getLogger('default')
  const messageLogger = log4js.getLogger('message')
  const errorLogger = log4js.getLogger('error')

  const decoder = (...logs: any[]) => {
    return logs.reduce((pre, cur) => {
      if (cur instanceof Error) {
        pre.push(cur.message)
        cur.stack && pre.push(decodeURI(cur.stack))
      } else {
        pre.push(cur)
      }
      return pre
    }, [])
  }
  const chalk = new Chalk({ level: 3 })
  global.logger = {
    get level() {
      return (defaultLogger.level as log4js.Level)?.levelStr
    },
    set level(level) {
      defaultLogger.level = level
    },
    logout: [],
    chalk: chalk,
    red: chalk.rgb(251, 50, 50),
    blue: chalk.rgb(0, 155, 255),
    yellow: chalk.rgb(255, 220, 20),
    magenta: chalk.rgb(180, 110, 255),
    green: chalk.green,
    trace() {
      // @ts-expect-error
      defaultLogger.trace(...arguments)
    },
    debug() {
      // @ts-expect-error
      defaultLogger.debug(...arguments)
    },
    info() {
      // @ts-expect-error
      defaultLogger.info(...arguments)
    },
    warn() {
      // @ts-expect-error
      errorLogger.warn(...decoder(...arguments))
    },
    error() {
      // @ts-expect-error
      errorLogger.error(...decoder(...arguments))
    },
    mark() {
      // @ts-expect-error
      messageLogger.mark(...arguments)
    }
  }

}