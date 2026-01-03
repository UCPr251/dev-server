// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function () {
  // 更新页面时间戳
  updateTimestamp()

  // 初始化复制按钮功能
  initCopyButtons()

  // 初始化测试按钮
  initTestButtons()

  // 初始化文档链接
  initDocLinks()

  // 添加CSS修改测试
  addCssTestStyles()

  // 监听WebSocket消息（模拟）
  simulateWebSocketConnection()

  // 页面加载日志
  addRefreshLog('页面加载完成')
})

// 更新页面时间戳
function updateTimestamp() {
  const timestampElement = document.getElementById('timestamp')
  if (timestampElement) {
    const now = new Date()
    timestampElement.textContent = now.toLocaleString()

    // 每秒更新时间戳
    setInterval(() => {
      const now = new Date()
      timestampElement.textContent = now.toLocaleString()
    }, 1000)
  }
}

// 初始化复制按钮
function initCopyButtons() {
  const copyButtons = document.querySelectorAll('.copy-btn')

  copyButtons.forEach(button => {
    button.addEventListener('click', function () {
      const textToCopy = this.getAttribute('data-clipboard-text')

      // 使用Clipboard API复制文本
      navigator.clipboard.writeText(textToCopy).then(() => {
        showNotification('命令已复制到剪贴板')

        // 暂时改变按钮状态
        const originalHTML = this.innerHTML
        this.innerHTML = '<i class="fas fa-check"></i> 已复制'
        this.style.backgroundColor = 'rgba(72, 187, 120, 0.2)'
        this.style.borderColor = 'rgba(72, 187, 120, 0.5)'
        this.style.color = 'var(--success-color)'

        setTimeout(() => {
          this.innerHTML = originalHTML
          this.style.backgroundColor = ''
          this.style.borderColor = ''
          this.style.color = ''
        }, 2000)
      }).catch(err => {
        console.error('复制失败: ', err)
        showNotification('复制失败，请手动复制', 'error')
      })
    })
  })
}

// 显示通知
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification')
  const notificationText = document.getElementById('notification-text')

  // 设置通知内容和样式
  notificationText.textContent = message

  // 根据类型设置颜色
  if (type === 'error') {
    notification.style.backgroundColor = 'var(--error-color)'
    notification.querySelector('i').className = 'fas fa-exclamation-circle'
  } else if (type === 'warning') {
    notification.style.backgroundColor = 'var(--warning-color)'
    notification.querySelector('i').className = 'fas fa-exclamation-triangle'
  } else {
    notification.style.backgroundColor = 'var(--success-color)'
    notification.querySelector('i').className = 'fas fa-check-circle'
  }

  // 显示通知
  notification.style.display = 'flex'

  // 3秒后隐藏通知
  setTimeout(() => {
    notification.style.display = 'none'
  }, 3000)
}

// 初始化测试按钮
function initTestButtons() {
  const cssTestBtn = document.getElementById('css-test')
  const jsTestBtn = document.getElementById('js-test')
  const fullTestBtn = document.getElementById('full-test')

  if (cssTestBtn) {
    cssTestBtn.addEventListener('click', function () {
      testCssRefresh()
      addRefreshLog('手动触发了CSS刷新测试')
    })
  }

  if (jsTestBtn) {
    jsTestBtn.addEventListener('click', function () {
      testJsRefresh()
      addRefreshLog('手动触发了JS刷新测试')
    })
  }

  if (fullTestBtn) {
    fullTestBtn.addEventListener('click', function () {
      testFullRefresh()
      addRefreshLog('手动触发了完整页面刷新测试')
    })
  }
}

// 添加CSS测试样式
function addCssTestStyles() {
  // 动态添加一些样式，用于测试CSS刷新
  const style = document.createElement('style')
  style.id = 'test-styles'
  style.textContent = `
        /* 测试样式 - 可以通过DevServer刷新 */
        .card {
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .test-btn:active {
            transform: scale(0.98);
        }
        
        .highlight {
            animation: highlight 2s ease;
        }
        
        @keyframes highlight {
            0% { background-color: rgba(108, 99, 255, 0.1); }
            50% { background-color: rgba(108, 99, 255, 0.3); }
            100% { background-color: rgba(108, 99, 255, 0.1); }
        }
    `
  document.head.appendChild(style)
}

// 测试CSS刷新
function testCssRefresh() {
  // 添加高亮效果
  const cards = document.querySelectorAll('.card')
  cards.forEach(card => {
    card.classList.add('highlight')

    // 移除高亮类
    setTimeout(() => {
      card.classList.remove('highlight')
    }, 2000)
  })

  // 显示消息
  showNotification('CSS刷新测试 - 卡片高亮效果已触发')
}

// 测试JS刷新
function testJsRefresh() {
  // 创建动态内容
  const timestampElement = document.getElementById('timestamp')
  if (timestampElement) {
    const now = new Date()
    const originalText = timestampElement.textContent

    // 显示JS执行效果
    timestampElement.textContent = `JS测试: ${now.toLocaleTimeString()}`
    timestampElement.style.color = 'var(--secondary-color)'
    timestampElement.style.fontWeight = 'bold'

    // 3秒后恢复
    setTimeout(() => {
      timestampElement.textContent = originalText
      timestampElement.style.color = ''
      timestampElement.style.fontWeight = ''
    }, 3000)
  }

  // 显示消息
  showNotification('JS刷新测试 - 时间戳已更新', 'info')
}

// 测试完整刷新
function testFullRefresh() {
  // 模拟完整页面刷新
  const body = document.body
  body.style.opacity = '0.7'
  body.style.transition = 'opacity 0.3s ease'

  setTimeout(() => {
    body.style.opacity = '1'
    addRefreshLog('模拟了完整页面刷新效果')
    showNotification('完整刷新测试 - 页面淡入淡出效果', 'warning')
  }, 300)
}

// 模拟WebSocket连接
function simulateWebSocketConnection() {
  // 模拟WebSocket消息接收（实际项目中由DevServer注入的脚本处理）
  console.log('模拟WebSocket连接建立...')

  // 模拟接收到文件变更消息
  setTimeout(() => {
    // 随机模拟文件变更
    const events = ['CSS文件修改', 'JS文件更新', 'HTML文件变更', '图片资源添加']
    const randomEvent = events[Math.floor(Math.random() * events.length)]

    // 随机决定是否添加日志
    if (Math.random() > 0.7) {
      addRefreshLog(`模拟: ${randomEvent} 检测到变更`)
    }
  }, 5000)

  // 定期模拟心跳
  setInterval(() => {
    // 实际项目中会有WebSocket心跳保持连接
    console.log('WebSocket心跳...')
  }, 30000)
}

// 添加刷新日志
function addRefreshLog(message) {
  const refreshLog = document.getElementById('refresh-log')
  if (refreshLog) {
    const now = new Date()
    const timeStr = now.toLocaleTimeString()
    const logItem = document.createElement('li')
    logItem.textContent = `[${timeStr}] ${message}`

    // 添加到列表顶部
    refreshLog.insertBefore(logItem, refreshLog.firstChild)

    // 限制日志数量
    if (refreshLog.children.length > 10) {
      refreshLog.removeChild(refreshLog.lastChild)
    }
  }
}

// 初始化文档链接
function initDocLinks() {
  const docsLink = document.getElementById('docs-link')
  if (docsLink) {
    docsLink.addEventListener('click', function (e) {
      e.preventDefault()
      showNotification('文档功能尚未实现，敬请期待！', 'info')
    })
  }
}

// 导出函数供外部使用（如果需要）
window.DevServerDemo = {
  testCssRefresh,
  testJsRefresh,
  testFullRefresh,
  addRefreshLog,
  showNotification
}

// 页面卸载前清理
window.addEventListener('beforeunload', function () {
  console.log('页面即将卸载...')
})