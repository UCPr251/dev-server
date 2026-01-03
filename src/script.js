export default function () {
  console.log('[DevServer] Injecting hot reload client...')

  if (window.__devServerClient) {
    console.log('[DevServer] Client already exists')
    return window.__devServerClient
  }

  class DevServerClient {
    constructor() {
      this.ws = null
      this.reconnectAttempts = 0
      this.maxReconnectAttempts = 10
      this.reconnectDelay = 1000
      this.connect()

      // 存储页面状态
      this.state = {
        scrollPosition: { x: 0, y: 0 },
        formData: {},
        currentPath: window.location.pathname
      }

      this.saveState()
      this.setupEventListeners()
    }

    connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = protocol + '//' + window.location.host
      this.ws = new WebSocket(wsUrl)
      this.ws.onopen = () => {
        console.log('[DevServer] Connected to hot reload server')
        this.reconnectAttempts = 0
        this.send({ type: 'HELLO', version: '1.0' })
      }
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }
      this.ws.onclose = () => {
        console.log('[DevServer] Disconnected')
        this.scheduleReconnect()
      }
      this.ws.onerror = (error) => {
        console.error('[DevServer] WebSocket error:', error)
      }
    }

    handleMessage(data) {
      try {
        const message = JSON.parse(data)
        console.log('[DevServer] Received:', message.type)
        switch (message.type) {
          case 'WELCOME':
            console.log('[DevServer] Server ready')
            break
          case 'FILE_CHANGED':
            this.handleFileChange(message.data)
            break
          case 'REFRESH_CSS':
            this.refreshCSS(message.data.filePath)
            break
          case 'REFRESH_JS':
            this.refreshJS(message.data.filePath)
            break
          case 'RELOAD':
            this.reloadPage(message.data)
            break
          case 'PING':
            this.send({ type: 'PONG' })
            break
        }
      } catch (error) {
        console.error('[DevServer] Error handling message:', error)
      }
    }

    handleFileChange(data) {
      const { filePath, event } = data
      const ext = filePath.split('.').pop().toLowerCase()
      // 保存当前状态
      this.saveState()
      // 根据文件类型执行不同的更新策略
      switch (ext) {
        case 'css':
          this.refreshCSS(filePath)
          break
        case 'js':
          this.refreshJS(filePath)
          break
        case 'html':
          // HTML文件变化时检查是否是当前页面
          if (this.isCurrentPage(filePath)) {
            this.reloadPage({ reason: 'HTML changed' })
          } else {
            // 不是当前页面，仅通知
            this.showNotification('Related HTML file changed')
          }
          break
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
          this.refreshImages(filePath)
          break
        default:
          // 其他文件类型，刷新页面
          this.reloadPage({ reason: 'Unknown file type changed' })
      }
    }

    refreshCSS(filePath) {
      console.log('[DevServer] Refreshing CSS:', filePath)
      // 方法1: 修改link标签的时间戳
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      const timestamp = '?t=' + Date.now()
      links.forEach(link => {
        const href = link.getAttribute('href')
        if (href && href.includes(filePath)) {
          const newHref = href.replace(/\\?t=\\d+/, '') + timestamp
          link.setAttribute('href', newHref)
          console.log('[DevServer] Updated CSS link:', newHref)
        }
      })
      // 方法2: 如果方法1无效，创建新的style标签
      setTimeout(() => {
        // 检查页面样式是否更新
        const styleSheets = Array.from(document.styleSheets)
        const updated = styleSheets.some(sheet => {
          try {
            return sheet.href && sheet.href.includes(filePath)
          } catch {
            return false
          }
        })
        if (!updated) {
          this.reloadPage({ reason: 'CSS refresh failed' })
        }
      }, 500)
    }

    refreshJS(filePath) {
      console.log('[DevServer] Refreshing JS:', filePath)
      // 对于JavaScript，通常需要重新执行
      // 这里我们可以重新加载脚本或刷新页面
      const scripts = Array.from(document.querySelectorAll('script[src]'))
      const shouldReload = scripts.some(script => {
        const src = script.getAttribute('src')
        return src && src.includes(filePath)
      })
      if (shouldReload) {
        // 显示提示，询问是否刷新
        if (this.showRefreshPrompt()) {
          this.reloadPage({ reason: 'JS file changed' })
        }
      }
    }

    refreshImages(filePath) {
      console.log('[DevServer] Refreshing image:', filePath)
      // 更新所有匹配的图片
      const images = Array.from(document.querySelectorAll('img'))
      const timestamp = '?t=' + Date.now()
      images.forEach(img => {
        const src = img.getAttribute('src')
        if (src && src.includes(filePath)) {
          const newSrc = src.replace(/\\?t=\\d+/, '') + timestamp
          img.setAttribute('src', newSrc)
        }
      })
    }

    isCurrentPage(filePath) {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html'
      return filePath.includes(currentPage)
    }

    reloadPage(data = {}) {
      console.log('[DevServer] Reloading page:', data.reason)
      // 恢复滚动位置
      const restoreScroll = () => {
        if (this.state.scrollPosition) {
          window.scrollTo(this.state.scrollPosition.x, this.state.scrollPosition.y)
        }
      }
      // 恢复表单数据
      const restoreForms = () => {
        Object.entries(this.state.formData).forEach(([id, value]) => {
          const element = document.getElementById(id)
          if (element) {
            element.value = value
          }
        })
      }
      // 保存回调函数供新页面使用
      window.__devServerRestoreState = () => {
        restoreScroll()
        restoreForms()
      }
      window.location.reload()
    }

    saveState() {
      // 保存滚动位置
      this.state.scrollPosition = {
        x: window.scrollX,
        y: window.scrollY
      }
      // 保存表单数据
      this.state.formData = {}
      const formElements = document.querySelectorAll('input, textarea, select')
      formElements.forEach((el, index) => {
        if (el.id) {
          this.state.formData[el.id] = el.value
        } else if (el.name) {
          this.state.formData[el.name] = el.value
        } else {
          this.state.formData['element_' + index] = el.value
        }
      })
      // 保存当前路径
      this.state.currentPath = window.location.pathname
    }

    showNotification(message) {
      // 创建通知元素
      let notification = document.getElementById('dev-server-notification')
      if (!notification) {
        notification = document.createElement('div')
        notification.id = 'dev-server-notification'
        notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 12px 24px;
                border-radius: 4px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                z-index: 9999;
                font-family: sans-serif;
                font-size: 14px;
                animation: slideIn 0.3s ease;
              `
        // 添加CSS动画
        const style = document.createElement('style')
        style.textContent = `
                @keyframes slideIn {
                  from { transform: translateX(100%); opacity: 0; }
                  to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeOut {
                  from { opacity: 1; }
                  to { opacity: 0; }
                }
              `
        document.head.appendChild(style)
        document.body.appendChild(notification)
      }
      notification.textContent = message
      notification.style.background = '#4CAF50'
      // 自动消失
      clearTimeout(this.notificationTimeout)
      this.notificationTimeout = setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease'
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification)
          }
        }, 300)
      }, 3000)
    }

    showRefreshPrompt() {
      // 在生产环境中，可以返回true自动刷新
      // 在开发中，可以显示确认对话框
      if (this.isDevMode()) {
        return confirm('JavaScript file changed. Reload page?')
      }
      return true
    }

    isDevMode() {
      return window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    }

    send(data) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data))
      }
    }

    scheduleReconnect() {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5)
        console.log(`[DevServer] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
        setTimeout(() => {
          if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            this.connect()
          }
        }, delay)
      }
    }

    setupEventListeners() {
      // 监听页面可见性变化
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.ws) {
          this.send({ type: 'VISIBLE' })
        }
      })
      // 监听表单输入，实时保存状态
      document.addEventListener('input', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.tagName === 'SELECT')) {
          this.saveState()
        }
      })
    }
  }

  // 初始化客户端
  window.__devServerClient = new DevServerClient()

  // 页面加载完成后恢复状态
  window.addEventListener('load', () => {
    if (window.__devServerRestoreState) {
      window.__devServerRestoreState()
      delete window.__devServerRestoreState
    }
  })

  // 导出以供调试
  window.DevServer = window.__devServerClient
  console.log('[DevServer] Hot reload client ready')
  return window.__devServerClient
}