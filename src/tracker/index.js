/**
 * WeiboTracker - 高性能用户行为统计 SDK
 * 
 * 核心能力：
 * 1. 行为追踪（点击、滚动、曝光）
 * 2. 时长统计（页面停留、阅读停留）
 * 3. 信息点击追踪
 * 4. 曝光追踪（Intersection Observer）
 * 5. 批量上报 + 空闲调度 + 离线缓存
 * 
 * 性能策略：
 * - requestIdleCallback 空闲上报
 * - 批量合并减少请求
 * - Intersection Observer 曝光检测
 * - visibilitychange 页面可见性
 * - localStorage 离线缓存
 * - 精确到毫秒的停留时长
 */

// ============ 事件类型枚举 ============
export const EventType = {
  PAGE_VIEW: 'page_view',           // 页面浏览
  PAGE_STAY: 'page_stay',           // 页面停留
  POST_CLICK: 'post_click',         // 信息流点击
  POST_EXPOSURE: 'post_exposure',   // 信息曝光
  POST_READ: 'post_read',           // 阅读停留
  ACTION_CLICK: 'action_click',     // 交互点击（点赞/评论/转发）
  SCROLL_DEPTH: 'scroll_depth',     // 滚动深度
  SEARCH: 'search',                 // 搜索行为
  SESSION: 'session',               // 会话统计
}

// ============ 配置 ============
const DEFAULT_CONFIG = {
  endpoint: '/api/track',           // 上报接口
  batchSize: 10,                    // 批量上报数量
  flushInterval: 5000,              // 定时上报间隔(ms)
  idleTimeout: 2000,                // requestIdleCallback 超时
  exposureThreshold: 0.5,           // 曝光可见比例阈值
  exposureDuration: 500,            // 最短曝光时间(ms)
  enableScrollDepth: true,          // 是否追踪滚动深度
  scrollDepthSteps: [25, 50, 75, 90, 100], // 滚动深度节点
  maxRetryCount: 3,                 // 最大重试次数
  storageKey: 'wb_tracker_queue',   // localStorage key
}

// ============ 工具函数 ============
const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
const now = () => performance.now()
const ts = () => Date.now()

// requestIdleCallback polyfill
const scheduleIdle = window.requestIdleCallback 
  ? window.requestIdleCallback 
  : (cb) => setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 50 }), 16)

// ============ 事件缓冲队列 ============
class EventBuffer {
  constructor(maxSize = 50) {
    this.queue = []
    this.maxSize = maxSize
  }

  push(event) {
    if (this.queue.length >= this.maxSize) {
      this.flush()
    }
    this.queue.push(event)
  }

  drain() {
    const events = [...this.queue]
    this.queue = []
    return events
  }

  get length() {
    return this.queue.length
  }
}

// ============ 离线存储 ============
class OfflineStore {
  constructor(key) {
    this.key = key
  }

  save(events) {
    try {
      const existing = this.load()
      const merged = [...existing, ...events].slice(-100) // 最多保留100条
      localStorage.setItem(this.key, JSON.stringify(merged))
    } catch (e) {
      // localStorage 满了，清空旧数据
      localStorage.removeItem(this.key)
    }
  }

  load() {
    try {
      const data = localStorage.getItem(this.key)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  clear() {
    localStorage.removeItem(this.key)
  }
}

// ============ 曝光观察器 ============
class ExposureObserver {
  constructor(tracker, threshold, minDuration) {
    this.tracker = tracker
    this.threshold = threshold
    this.minDuration = minDuration
    this.observer = null
    this.visibleMap = new Map() // element -> { enterTime, postId }
    this.init()
  }

  init() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target
          const postId = el.dataset.trackId

          if (entry.isIntersecting && entry.intersectionRatio >= this.threshold) {
            // 进入可见区域
            this.visibleMap.set(el, { enterTime: now(), postId })
          } else {
            // 离开可见区域
            const info = this.visibleMap.get(el)
            if (info) {
              const duration = now() - info.enterTime
              if (duration >= this.minDuration) {
                this.tracker.track(EventType.POST_EXPOSURE, {
                  postId: info.postId,
                  duration: Math.round(duration),
                  ratio: Math.round(entry.intersectionRatio * 100),
                })
              }
              this.visibleMap.delete(el)
            }
          }
        })
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1.0] }
    )
  }

  observe(element, postId) {
    if (element && this.observer) {
      element.dataset.trackId = postId
      this.observer.observe(element)
    }
  }

  unobserve(element) {
    if (element && this.observer) {
      // 处理还在可见区域的元素
      const info = this.visibleMap.get(element)
      if (info) {
        const duration = now() - info.enterTime
        if (duration >= this.minDuration) {
          this.tracker.track(EventType.POST_EXPOSURE, {
            postId: info.postId,
            duration: Math.round(duration),
            ratio: 100,
          })
        }
        this.visibleMap.delete(element)
      }
      this.observer.unobserve(element)
    }
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect()
    }
    this.visibleMap.clear()
  }
}

// ============ 阅读停留计时器 ============
class ReadTimer {
  constructor(tracker) {
    this.tracker = tracker
    this.timers = new Map() // postId -> { startTime, accumulated, rafId }
    this.paused = new Set()
  }

  start(postId) {
    if (this.timers.has(postId)) return
    this.timers.set(postId, {
      startTime: now(),
      accumulated: 0,
      rafId: null,
    })
  }

  pause(postId) {
    const timer = this.timers.get(postId)
    if (timer && !this.paused.has(postId)) {
      timer.accumulated += now() - timer.startTime
      this.paused.add(postId)
    }
  }

  resume(postId) {
    const timer = this.timers.get(postId)
    if (timer && this.paused.has(postId)) {
      timer.startTime = now()
      this.paused.delete(postId)
    }
  }

  stop(postId) {
    const timer = this.timers.get(postId)
    if (!timer) return 0
    let total = timer.accumulated
    if (!this.paused.has(postId)) {
      total += now() - timer.startTime
    }
    this.timers.delete(postId)
    this.paused.delete(postId)
    return Math.round(total)
  }

  // 暂停所有计时器（页面不可见时）
  pauseAll() {
    this.timers.forEach((_, postId) => this.pause(postId))
  }

  // 恢复所有计时器（页面重新可见时）
  resumeAll() {
    this.timers.forEach((_, postId) => this.resume(postId))
  }
}

// ============ 滚动深度追踪器 ============
class ScrollDepthTracker {
  constructor(tracker, steps) {
    this.tracker = tracker
    this.steps = [...steps].sort((a, b) => a - b)
    this.reached = new Set()
    this.lastScrollPercent = 0
  }

  update() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    if (docHeight <= 0) return
    const percent = Math.min(100, Math.round((scrollTop / docHeight) * 100))
    this.lastScrollPercent = percent

    for (const step of this.steps) {
      if (percent >= step && !this.reached.has(step)) {
        this.reached.add(step)
        this.tracker.track(EventType.SCROLL_DEPTH, {
          depth: step,
          scrollPx: scrollTop,
          docHeight: document.documentElement.scrollHeight,
        })
      }
    }
  }

  reset() {
    this.reached.clear()
    this.lastScrollPercent = 0
  }

  getDepth() {
    return this.lastScrollPercent
  }
}

// ============ 主 Tracker 类 ============
class WeiboTracker {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.buffer = new EventBuffer()
    this.offlineStore = new OfflineStore(this.config.storageKey)
    this.readTimer = new ReadTimer(this)
    this.exposureObserver = new ExposureObserver(
      this, this.config.exposureThreshold, this.config.exposureDuration
    )
    this.scrollTracker = this.config.enableScrollDepth
      ? new ScrollDepthTracker(this, this.config.scrollDepthSteps)
      : null

    // 会话信息
    this.sessionId = generateId()
    this.sessionStart = ts()
    this.pageEnterTime = now()
    this.currentPage = null
    this.currentPostId = null

    // 上报状态
    this.flushTimer = null
    this.retryCount = 0

    this._init()
  }

  _init() {
    // 恢复离线数据
    this._restoreOffline()

    // 定时上报
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval)

    // 页面可见性
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.readTimer.pauseAll()
        this._flushOnLeave()
      } else {
        this.readTimer.resumeAll()
        this.sessionId = generateId()
        this.sessionStart = ts()
      }
    })

    // 滚动追踪
    if (this.scrollTracker) {
      let scrollTick = false
      window.addEventListener('scroll', () => {
        if (!scrollTick) {
          requestAnimationFrame(() => {
            this.scrollTracker.update()
            scrollTick = false
          })
          scrollTick = true
        }
      }, { passive: true })
    }

    // 页面卸载
    window.addEventListener('beforeunload', () => this._flushOnLeave())

    // 首次会话
    this.track(EventType.SESSION, { action: 'start' })
  }

  // ============ 核心追踪方法 ============

  /**
   * 记录一个事件
   */
  track(eventType, data = {}) {
    const event = {
      id: generateId(),
      type: eventType,
      sessionId: this.sessionId,
      timestamp: ts(),
      page: this.currentPage,
      data,
    }
    this.buffer.push(event)
    
    // 达到批量阈值时，利用空闲时间上报
    if (this.buffer.length >= this.config.batchSize) {
      this._scheduleFlush()
    }
  }

  /**
   * 页面浏览
   */
  pageView(pageName, extra = {}) {
    // 如果有前一个页面，记录停留时长
    if (this.currentPage) {
      this.pageLeave()
    }

    this.currentPage = pageName
    this.pageEnterTime = now()

    this.track(EventType.PAGE_VIEW, {
      page: pageName,
      referrer: document.referrer,
      ...extra,
    })

    // 重置滚动追踪
    if (this.scrollTracker) {
      this.scrollTracker.reset()
    }
  }

  /**
   * 页面离开 - 记录停留时长
   */
  pageLeave() {
    if (!this.currentPage) return
    const stayDuration = now() - this.pageEnterTime
    const scrollDepth = this.scrollTracker ? this.scrollTracker.getDepth() : 0

    this.track(EventType.PAGE_STAY, {
      page: this.currentPage,
      duration: Math.round(stayDuration),
      scrollDepth,
    })
  }

  /**
   * 信息流帖子点击
   */
  postClick(postId, extra = {}) {
    this.track(EventType.POST_CLICK, {
      postId,
      source: this.currentPage,
      ...extra,
    })
  }

  /**
   * 交互行为（点赞/评论/转发）
   */
  actionClick(action, postId, extra = {}) {
    this.track(EventType.ACTION_CLICK, {
      action,
      postId,
      source: this.currentPage,
      ...extra,
    })
  }

  /**
   * 开始阅读计时
   */
  startReading(postId) {
    this.currentPostId = postId
    this.readTimer.start(postId)
  }

  /**
   * 结束阅读计时并上报
   */
  stopReading(postId) {
    const duration = this.readTimer.stop(postId || this.currentPostId)
    if (duration > 0) {
      this.track(EventType.POST_READ, {
        postId: postId || this.currentPostId,
        duration,
        page: this.currentPage,
      })
    }
    this.currentPostId = null
    return duration
  }

  /**
   * 观察元素曝光
   */
  observeExposure(element, postId) {
    this.exposureObserver.observe(element, postId)
  }

  /**
   * 取消元素曝光观察
   */
  unobserveExposure(element) {
    this.exposureObserver.unobserve(element)
  }

  /**
   * 搜索行为
   */
  search(keyword, resultCount = 0) {
    this.track(EventType.SEARCH, { keyword, resultCount })
  }

  // ============ 上报方法 ============

  flush() {
    const events = this.buffer.drain()
    if (events.length === 0) return

    this._send(events)
  }

  _scheduleFlush() {
    scheduleIdle(
      (deadline) => {
        if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
          this.flush()
        }
      },
      { timeout: this.config.idleTimeout }
    )
  }

  _flushOnLeave() {
    // 记录当前页面停留
    this.pageLeave()
    // 记录当前阅读
    if (this.currentPostId) {
      this.stopReading(this.currentPostId)
    }
    // 会话结束
    this.track(EventType.SESSION, {
      action: 'end',
      duration: ts() - this.sessionStart,
    })
    // 强制上报
    this.flush()
  }

  _send(events) {
    // 模拟上报 - 实际项目中替换为 fetch/beacon
    // 优先使用 sendBeacon，兜底 fetch
    const payload = JSON.stringify(events)

    if (navigator.sendBeacon) {
      const success = navigator.sendBeacon(this.config.endpoint, payload)
      if (success) {
        this.retryCount = 0
        this._sendToDashboard(events) // 发送到本地看板
        return
      }
    }

    // fetch 兜底
    fetch(this.config.endpoint, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).then(() => {
      this.retryCount = 0
      this._sendToDashboard(events)
    }).catch(() => {
      this.retryCount++
      if (this.retryCount < this.config.maxRetryCount) {
        this.offlineStore.save(events)
      }
    })
  }

  // 发送到本地统计看板（演示用）
  _sendToDashboard(events) {
    try {
      const existing = JSON.parse(localStorage.getItem('wb_dashboard_events') || '[]')
      const merged = [...existing, ...events].slice(-500)
      localStorage.setItem('wb_dashboard_events', JSON.stringify(merged))
      // 触发自定义事件，让 Dashboard 实时更新
      window.dispatchEvent(new CustomEvent('tracker-update', { detail: events }))
    } catch {
      // ignore
    }
  }

  _restoreOffline() {
    const events = this.offlineStore.load()
    if (events.length > 0) {
      this._send(events)
      this.offlineStore.clear()
    }
  }

  // ============ 销毁 ============
  destroy() {
    clearInterval(this.flushTimer)
    this.exposureObserver.disconnect()
    this._flushOnLeave()
  }

  // ============ 调试 ============
  getDebugInfo() {
    return {
      sessionId: this.sessionId,
      currentPage: this.currentPage,
      currentPostId: this.currentPostId,
      bufferSize: this.buffer.length,
      activeReadTimers: this.timers?.size || 0,
      scrollDepth: this.scrollTracker?.getDepth() || 0,
    }
  }
}

// 单例导出
let instance = null

export function createTracker(config) {
  if (!instance) {
    instance = new WeiboTracker(config)
  }
  return instance
}

export function getTracker() {
  return instance
}

export default WeiboTracker
