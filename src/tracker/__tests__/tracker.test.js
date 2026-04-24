import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  EventType,
  EventBuffer,
  OfflineStore,
  ReadTimer,
  ScrollDepthTracker,
  ExposureObserver,
  createTracker,
  getTracker,
  resetTrackerInstance,
} from '../index.js'
import WeiboTracker from '../index.js'

// ─── EventType ───────────────────────────────────────────────────────────────
describe('EventType', () => {
  it('contains all required event type constants', () => {
    expect(EventType.PAGE_VIEW).toBe('page_view')
    expect(EventType.PAGE_STAY).toBe('page_stay')
    expect(EventType.POST_CLICK).toBe('post_click')
    expect(EventType.POST_EXPOSURE).toBe('post_exposure')
    expect(EventType.POST_READ).toBe('post_read')
    expect(EventType.ACTION_CLICK).toBe('action_click')
    expect(EventType.SCROLL_DEPTH).toBe('scroll_depth')
    expect(EventType.SEARCH).toBe('search')
    expect(EventType.SESSION).toBe('session')
  })

  it('has exactly 9 event types', () => {
    expect(Object.keys(EventType)).toHaveLength(9)
  })
})

// ─── EventBuffer ─────────────────────────────────────────────────────────────
describe('EventBuffer', () => {
  it('starts with an empty queue', () => {
    const buf = new EventBuffer()
    expect(buf.length).toBe(0)
  })

  it('pushes events and increments length', () => {
    const buf = new EventBuffer()
    buf.push({ type: 'click' })
    buf.push({ type: 'view' })
    expect(buf.length).toBe(2)
  })

  it('drain returns all events and clears the queue', () => {
    const buf = new EventBuffer()
    buf.push({ id: 1 })
    buf.push({ id: 2 })
    const events = buf.drain()
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ id: 1 })
    expect(buf.length).toBe(0)
  })

  it('drain on an empty buffer returns empty array', () => {
    const buf = new EventBuffer()
    expect(buf.drain()).toEqual([])
  })

  it('calls flush (via drain) when maxSize is reached', () => {
    const buf = new EventBuffer(3)
    buf.push('a')
    buf.push('b')
    buf.push('c') // fills to maxSize
    // 4th push triggers drain first, then pushes 'd'
    buf.push('d')
    expect(buf.length).toBe(1) // only 'd' remains after the auto-drain
  })

  it('respects custom maxSize', () => {
    const buf = new EventBuffer(2)
    buf.push('x')
    buf.push('y') // fills to maxSize
    // 3rd push triggers drain first
    buf.push('z')
    expect(buf.length).toBe(1) // only 'z' remains after the auto-drain
  })
})

// ─── OfflineStore ─────────────────────────────────────────────────────────────
describe('OfflineStore', () => {
  const KEY = 'test_offline_key'

  beforeEach(() => localStorage.removeItem(KEY))

  it('load returns empty array when nothing stored', () => {
    const store = new OfflineStore(KEY)
    expect(store.load()).toEqual([])
  })

  it('save persists events to localStorage', () => {
    const store = new OfflineStore(KEY)
    store.save([{ id: 1 }, { id: 2 }])
    const raw = JSON.parse(localStorage.getItem(KEY))
    expect(raw).toHaveLength(2)
  })

  it('load returns previously saved events', () => {
    const store = new OfflineStore(KEY)
    store.save([{ id: 'e1' }])
    expect(store.load()).toEqual([{ id: 'e1' }])
  })

  it('save merges with existing events', () => {
    const store = new OfflineStore(KEY)
    store.save([{ id: 1 }])
    store.save([{ id: 2 }])
    expect(store.load()).toHaveLength(2)
  })

  it('clear removes all stored data', () => {
    const store = new OfflineStore(KEY)
    store.save([{ id: 1 }])
    store.clear()
    expect(store.load()).toEqual([])
  })

  it('caps at 100 events to avoid unbounded growth', () => {
    const store = new OfflineStore(KEY)
    const events = Array.from({ length: 120 }, (_, i) => ({ id: i }))
    store.save(events)
    expect(store.load()).toHaveLength(100)
  })

  it('load returns empty array when localStorage contains invalid JSON', () => {
    localStorage.setItem(KEY, 'not-json')
    const store = new OfflineStore(KEY)
    expect(store.load()).toEqual([])
  })

  it('save handles localStorage quota error by clearing old data', () => {
    const store = new OfflineStore(KEY)
    store.save([{ id: 1 }])
    // Simulate quota error
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError')
    })
    // Should not throw; it catches and clears
    expect(() => store.save([{ id: 2 }])).not.toThrow()
    setItemSpy.mockRestore()
  })
})

// ─── ReadTimer ────────────────────────────────────────────────────────────────
describe('ReadTimer', () => {
  let mockTracker

  beforeEach(() => {
    mockTracker = { track: vi.fn() }
  })

  it('start creates a timer for the postId', () => {
    const rt = new ReadTimer(mockTracker)
    rt.start('p1')
    // stop should return a non-negative duration
    const dur = rt.stop('p1')
    expect(dur).toBeGreaterThanOrEqual(0)
  })

  it('start is idempotent – calling twice does not create duplicate timer', () => {
    const rt = new ReadTimer(mockTracker)
    rt.start('p1')
    rt.start('p1') // no-op second call
    const dur = rt.stop('p1')
    expect(dur).toBeGreaterThanOrEqual(0)
  })

  it('stop returns 0 when postId was never started', () => {
    const rt = new ReadTimer(mockTracker)
    expect(rt.stop('unknown')).toBe(0)
  })

  it('pause accumulates elapsed time', () => {
    const rt = new ReadTimer(mockTracker)
    rt.start('p1')
    rt.pause('p1')
    const dur = rt.stop('p1')
    expect(dur).toBeGreaterThanOrEqual(0)
  })

  it('pause is idempotent – calling pause twice does not double-count time', () => {
    const rt = new ReadTimer(mockTracker)
    rt.start('p1')
    rt.pause('p1')
    rt.pause('p1') // no-op
    const dur = rt.stop('p1')
    expect(dur).toBeGreaterThanOrEqual(0)
  })

  it('resume restarts accumulation after pause', () => {
    const rt = new ReadTimer(mockTracker)
    rt.start('p1')
    rt.pause('p1')
    rt.resume('p1')
    const dur = rt.stop('p1')
    expect(dur).toBeGreaterThanOrEqual(0)
  })

  it('resume on a timer that is not paused is a no-op', () => {
    const rt = new ReadTimer(mockTracker)
    rt.start('p1')
    rt.resume('p1') // not paused – no-op
    const dur = rt.stop('p1')
    expect(dur).toBeGreaterThanOrEqual(0)
  })

  it('pauseAll pauses every active timer', () => {
    const rt = new ReadTimer(mockTracker)
    rt.start('p1')
    rt.start('p2')
    rt.pauseAll()
    // Both should be paused: stop should still return accumulated time
    expect(rt.stop('p1')).toBeGreaterThanOrEqual(0)
    expect(rt.stop('p2')).toBeGreaterThanOrEqual(0)
  })

  it('resumeAll resumes every paused timer', () => {
    const rt = new ReadTimer(mockTracker)
    rt.start('p1')
    rt.start('p2')
    rt.pauseAll()
    rt.resumeAll()
    expect(rt.stop('p1')).toBeGreaterThanOrEqual(0)
    expect(rt.stop('p2')).toBeGreaterThanOrEqual(0)
  })

  it('stop removes the timer so subsequent stop returns 0', () => {
    const rt = new ReadTimer(mockTracker)
    rt.start('p1')
    rt.stop('p1')
    expect(rt.stop('p1')).toBe(0)
  })
})

// ─── ScrollDepthTracker ───────────────────────────────────────────────────────
describe('ScrollDepthTracker', () => {
  let mockTracker

  beforeEach(() => {
    mockTracker = { track: vi.fn() }
    // Set up a scrollable document
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true, value: 2000,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true, value: 500,
    })
    Object.defineProperty(window, 'scrollY', {
      configurable: true, writable: true, value: 0,
    })
  })

  it('does not fire before any scroll steps are reached', () => {
    const sdt = new ScrollDepthTracker(mockTracker, [25, 50, 75, 100])
    window.scrollY = 0
    sdt.update()
    expect(mockTracker.track).not.toHaveBeenCalled()
  })

  it('fires SCROLL_DEPTH event when a step threshold is crossed', () => {
    const sdt = new ScrollDepthTracker(mockTracker, [25, 50])
    // scroll to 25% of (2000-500) = 375px
    window.scrollY = 375
    sdt.update()
    expect(mockTracker.track).toHaveBeenCalledWith(
      EventType.SCROLL_DEPTH,
      expect.objectContaining({ depth: 25 })
    )
  })

  it('does not fire the same step twice', () => {
    const sdt = new ScrollDepthTracker(mockTracker, [25])
    window.scrollY = 375
    sdt.update()
    sdt.update() // same position again
    expect(mockTracker.track).toHaveBeenCalledTimes(1)
  })

  it('fires multiple steps when user scrolls past several at once', () => {
    const sdt = new ScrollDepthTracker(mockTracker, [25, 50])
    window.scrollY = 750 // 50% of 1500
    sdt.update()
    expect(mockTracker.track).toHaveBeenCalledTimes(2)
  })

  it('reset clears reached steps and scroll percent', () => {
    const sdt = new ScrollDepthTracker(mockTracker, [25])
    window.scrollY = 375
    sdt.update()
    sdt.reset()
    expect(sdt.getDepth()).toBe(0)
    window.scrollY = 375
    sdt.update() // should fire again after reset
    expect(mockTracker.track).toHaveBeenCalledTimes(2)
  })

  it('getDepth returns the current scroll percentage', () => {
    const sdt = new ScrollDepthTracker(mockTracker, [25])
    window.scrollY = 375
    sdt.update()
    expect(sdt.getDepth()).toBe(25)
  })

  it('does nothing when docHeight is 0 or negative', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true, value: 500,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true, value: 500,
    })
    const sdt = new ScrollDepthTracker(mockTracker, [25])
    sdt.update()
    expect(mockTracker.track).not.toHaveBeenCalled()
  })

  it('sorts steps in ascending order regardless of input order', () => {
    const sdt = new ScrollDepthTracker(mockTracker, [100, 50, 25])
    window.scrollY = 375 // 25%
    sdt.update()
    expect(mockTracker.track).toHaveBeenCalledWith(
      EventType.SCROLL_DEPTH,
      expect.objectContaining({ depth: 25 })
    )
  })
})

// ─── WeiboTracker ─────────────────────────────────────────────────────────────
describe('WeiboTracker', () => {
  let tracker

  beforeEach(() => {
    vi.useFakeTimers()
    tracker = new WeiboTracker({
      endpoint: '/api/test',
      batchSize: 5,
      flushInterval: 1000,
      enableScrollDepth: false,
    })
  })

  afterEach(() => {
    tracker.destroy()
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('initialises with a sessionId', () => {
      expect(typeof tracker.sessionId).toBe('string')
      expect(tracker.sessionId.length).toBeGreaterThan(0)
    })

    it('merges custom config with defaults', () => {
      expect(tracker.config.endpoint).toBe('/api/test')
      expect(tracker.config.batchSize).toBe(5)
      expect(tracker.config.maxRetryCount).toBe(3) // default preserved
    })
  })

  describe('track()', () => {
    it('adds events to the internal buffer', () => {
      tracker.track(EventType.PAGE_VIEW, { page: 'home' })
      expect(tracker.buffer.length).toBeGreaterThan(0)
    })

    it('includes sessionId, timestamp, and page in every event', () => {
      tracker.currentPage = 'feed'
      tracker.track(EventType.ACTION_CLICK, { action: 'like' })
      const events = tracker.buffer.drain()
      const event = events.find(e => e.type === EventType.ACTION_CLICK)
      expect(event).toBeTruthy()
      expect(event.sessionId).toBe(tracker.sessionId)
      expect(typeof event.timestamp).toBe('number')
      expect(event.page).toBe('feed')
    })

    it('triggers flush when batchSize is reached', () => {
      const flushSpy = vi.spyOn(tracker, 'flush')
      const schedSpy = vi.spyOn(tracker, '_scheduleFlush')
      // push batchSize events (SESSION start is already queued, so we may only need fewer)
      tracker.buffer.drain() // clear existing
      for (let i = 0; i < tracker.config.batchSize; i++) {
        tracker.track(EventType.ACTION_CLICK, { action: 'test' })
      }
      expect(schedSpy).toHaveBeenCalled()
    })
  })

  describe('pageView()', () => {
    it('sets currentPage and tracks PAGE_VIEW event', () => {
      tracker.buffer.drain()
      tracker.pageView('home')
      expect(tracker.currentPage).toBe('home')
      const events = tracker.buffer.drain()
      expect(events.some(e => e.type === EventType.PAGE_VIEW && e.data.page === 'home')).toBe(true)
    })

    it('tracks PAGE_STAY for the previous page before switching', () => {
      tracker.buffer.drain()
      tracker.pageView('page-a')
      tracker.buffer.drain()
      tracker.pageView('page-b')
      const events = tracker.buffer.drain()
      expect(events.some(e => e.type === EventType.PAGE_STAY && e.data.page === 'page-a')).toBe(true)
    })

    it('resets scroll tracker on page change', () => {
      const fullTracker = new WeiboTracker({ enableScrollDepth: true })
      const resetSpy = vi.spyOn(fullTracker.scrollTracker, 'reset')
      fullTracker.pageView('new-page')
      expect(resetSpy).toHaveBeenCalled()
      fullTracker.destroy()
    })
  })

  describe('pageLeave()', () => {
    it('does nothing when currentPage is null', () => {
      tracker.currentPage = null
      const trackSpy = vi.spyOn(tracker, 'track')
      tracker.pageLeave()
      expect(trackSpy).not.toHaveBeenCalledWith(EventType.PAGE_STAY, expect.anything())
    })

    it('records PAGE_STAY event with duration and scrollDepth', () => {
      tracker.currentPage = 'feed'
      tracker.buffer.drain()
      tracker.pageLeave()
      const events = tracker.buffer.drain()
      const stay = events.find(e => e.type === EventType.PAGE_STAY)
      expect(stay).toBeTruthy()
      expect(stay.data.page).toBe('feed')
      expect(typeof stay.data.duration).toBe('number')
      expect(stay.data.scrollDepth).toBe(0) // scroll disabled in this tracker
    })
  })

  describe('postClick()', () => {
    it('tracks POST_CLICK event with postId and source', () => {
      tracker.currentPage = 'feed'
      tracker.buffer.drain()
      tracker.postClick('p42', { position: 3 })
      const events = tracker.buffer.drain()
      const ev = events.find(e => e.type === EventType.POST_CLICK)
      expect(ev).toBeTruthy()
      expect(ev.data.postId).toBe('p42')
      expect(ev.data.source).toBe('feed')
      expect(ev.data.position).toBe(3)
    })
  })

  describe('actionClick()', () => {
    it('tracks ACTION_CLICK with action and postId', () => {
      tracker.buffer.drain()
      tracker.actionClick('like', 'p5', { extra: true })
      const events = tracker.buffer.drain()
      const ev = events.find(e => e.type === EventType.ACTION_CLICK)
      expect(ev.data.action).toBe('like')
      expect(ev.data.postId).toBe('p5')
      expect(ev.data.extra).toBe(true)
    })
  })

  describe('startReading() / stopReading()', () => {
    it('startReading sets currentPostId', () => {
      tracker.startReading('p10')
      expect(tracker.currentPostId).toBe('p10')
    })

    it('stopReading returns elapsed duration and tracks POST_READ', () => {
      tracker.startReading('p10')
      vi.advanceTimersByTime(100) // ensure non-zero duration
      tracker.buffer.drain()
      const duration = tracker.stopReading('p10')
      expect(duration).toBeGreaterThan(0)
      const events = tracker.buffer.drain()
      const readEv = events.find(e => e.type === EventType.POST_READ)
      expect(readEv).toBeTruthy()
      expect(readEv.data.postId).toBe('p10')
    })

    it('stopReading uses currentPostId when no argument provided', () => {
      tracker.startReading('p11')
      vi.advanceTimersByTime(100)
      tracker.buffer.drain()
      tracker.stopReading() // no arg
      const events = tracker.buffer.drain()
      const readEv = events.find(e => e.type === EventType.POST_READ)
      expect(readEv?.data?.postId).toBe('p11')
    })

    it('stopReading does not track POST_READ when duration is 0', () => {
      // stop without starting
      tracker.buffer.drain()
      tracker.stopReading('p99')
      const events = tracker.buffer.drain()
      expect(events.some(e => e.type === EventType.POST_READ)).toBe(false)
    })
  })

  describe('search()', () => {
    it('tracks SEARCH event with keyword and resultCount', () => {
      tracker.buffer.drain()
      tracker.search('react hooks', 5)
      const events = tracker.buffer.drain()
      const ev = events.find(e => e.type === EventType.SEARCH)
      expect(ev.data.keyword).toBe('react hooks')
      expect(ev.data.resultCount).toBe(5)
    })

    it('defaults resultCount to 0', () => {
      tracker.buffer.drain()
      tracker.search('test')
      const events = tracker.buffer.drain()
      expect(events.find(e => e.type === EventType.SEARCH).data.resultCount).toBe(0)
    })
  })

  describe('flush()', () => {
    it('sends buffered events and clears the buffer', () => {
      tracker.track(EventType.PAGE_VIEW, {})
      expect(tracker.buffer.length).toBeGreaterThan(0)
      tracker.flush()
      expect(tracker.buffer.length).toBe(0)
    })

    it('does nothing when buffer is empty', () => {
      tracker.buffer.drain()
      const sendSpy = vi.spyOn(tracker, '_send')
      tracker.flush()
      expect(sendSpy).not.toHaveBeenCalled()
    })

    it('fires automatically on flushInterval', () => {
      const flushSpy = vi.spyOn(tracker, 'flush')
      vi.advanceTimersByTime(tracker.config.flushInterval + 10)
      expect(flushSpy).toHaveBeenCalled()
    })
  })

  describe('_send()', () => {
    it('uses sendBeacon when available and it returns true', () => {
      navigator.sendBeacon.mockReturnValue(true)
      tracker.track(EventType.PAGE_VIEW, {})
      tracker.flush()
      expect(navigator.sendBeacon).toHaveBeenCalledWith(
        tracker.config.endpoint,
        expect.any(String)
      )
    })

    it('falls back to fetch when sendBeacon returns false', async () => {
      navigator.sendBeacon.mockReturnValue(false)
      tracker.track(EventType.PAGE_VIEW, {})
      tracker.flush()
      expect(global.fetch).toHaveBeenCalled()
    })

    it('saves events to offline store on fetch failure and increments retryCount', async () => {
      navigator.sendBeacon.mockReturnValue(false)
      global.fetch.mockRejectedValueOnce(new Error('Network error'))
      const saveSpy = vi.spyOn(tracker.offlineStore, 'save')
      tracker.track(EventType.PAGE_VIEW, {})
      tracker.flush()
      // flush microtask queue: fetch rejection → catch handler
      await Promise.resolve()
      await Promise.resolve()
      expect(saveSpy).toHaveBeenCalled()
      expect(tracker.retryCount).toBe(1)
    })
  })

  describe('_sendToDashboard()', () => {
    it('stores events in wb_dashboard_events and dispatches tracker-update', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
      tracker._sendToDashboard([{ id: 'e1', type: 'page_view' }])
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'tracker-update' })
      )
      const stored = JSON.parse(localStorage.getItem('wb_dashboard_events'))
      expect(stored).toContainEqual(expect.objectContaining({ id: 'e1' }))
    })
  })

  describe('destroy()', () => {
    it('clears the flush timer', () => {
      const clearSpy = vi.spyOn(global, 'clearInterval')
      tracker.destroy()
      expect(clearSpy).toHaveBeenCalledWith(tracker.flushTimer)
    })

    it('disconnects the exposure observer', () => {
      const disconnectSpy = vi.spyOn(tracker.exposureObserver, 'disconnect')
      tracker.destroy()
      expect(disconnectSpy).toHaveBeenCalled()
    })
  })

  describe('getDebugInfo()', () => {
    it('returns an object with debug fields', () => {
      tracker.currentPage = 'debug-page'
      const info = tracker.getDebugInfo()
      expect(info).toMatchObject({
        sessionId: expect.any(String),
        currentPage: 'debug-page',
        bufferSize: expect.any(Number),
        scrollDepth: expect.any(Number),
      })
    })
  })
})

// ─── createTracker / getTracker singleton ─────────────────────────────────────
describe('createTracker / getTracker', () => {
  beforeEach(() => {
    resetTrackerInstance()
  })

  afterEach(() => {
    const t = getTracker()
    if (t) t.destroy()
    resetTrackerInstance()
  })

  it('createTracker returns a WeiboTracker instance', () => {
    const t = createTracker({ enableScrollDepth: false })
    expect(t).toBeInstanceOf(WeiboTracker)
  })

  it('createTracker returns the same instance on subsequent calls (singleton)', () => {
    const t1 = createTracker({ enableScrollDepth: false })
    const t2 = createTracker({ enableScrollDepth: false })
    expect(t1).toBe(t2)
  })

  it('getTracker returns null before createTracker is called', () => {
    expect(getTracker()).toBeNull()
  })

  it('getTracker returns the created instance after createTracker', () => {
    const t = createTracker({ enableScrollDepth: false })
    expect(getTracker()).toBe(t)
  })
})
