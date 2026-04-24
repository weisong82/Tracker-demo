import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExposure, useReadTracker, usePageView, withTrackClick, trackAction } from '../useTracker.js'

// Mock the tracker module so we can spy on tracker methods without side-effects
vi.mock('../../tracker', async (importOriginal) => {
  const original = await importOriginal()
  const mockTracker = {
    observeExposure: vi.fn(),
    unobserveExposure: vi.fn(),
    startReading: vi.fn(),
    stopReading: vi.fn(),
    pageView: vi.fn(),
    pageLeave: vi.fn(),
    postClick: vi.fn(),
    actionClick: vi.fn(),
    track: vi.fn(),
    search: vi.fn(),
  }
  return {
    ...original,
    createTracker: vi.fn(() => mockTracker),
    getTracker: vi.fn(() => mockTracker),
    _mockTracker: mockTracker, // expose for test assertions
  }
})

// Helper to get the mock tracker instance used by useTracker.js
async function getMockTracker() {
  const mod = await import('../../tracker')
  return mod._mockTracker
}

// ─── useExposure ──────────────────────────────────────────────────────────────
describe('useExposure', () => {
  it('returns a ref object', async () => {
    const { result } = renderHook(() => useExposure('p1'))
    expect(result.current).toBeDefined()
    expect(typeof result.current).toBe('object')
  })

  it('calls observeExposure on mount when ref is attached to a DOM element', async () => {
    const mockTracker = await getMockTracker()
    const { result } = renderHook(() => useExposure('p1'))

    // Simulate ref attachment by setting current on the returned ref
    const fakeEl = document.createElement('div')
    act(() => {
      Object.defineProperty(result.current, 'current', {
        configurable: true,
        get: () => fakeEl,
      })
    })
    // Re-render to trigger the effect with the new ref value
    // The hook already ran – we check the spy was called (from a fresh render)
    const { unmount } = renderHook(() => {
      const ref = useExposure('p2')
      // Attach a fake element immediately
      ref.current = fakeEl
      return ref
    })
    expect(mockTracker.observeExposure).toHaveBeenCalled()
    unmount()
  })

  it('calls unobserveExposure on unmount', async () => {
    const mockTracker = await getMockTracker()
    const fakeEl = document.createElement('div')

    const { unmount } = renderHook(() => {
      const ref = useExposure('p3')
      ref.current = fakeEl
      return ref
    })

    unmount()
    expect(mockTracker.unobserveExposure).toHaveBeenCalledWith(fakeEl)
  })
})

// ─── useReadTracker ────────────────────────────────────────────────────────────
describe('useReadTracker', () => {
  it('calls startReading on mount when active=true (default)', async () => {
    const mockTracker = await getMockTracker()
    renderHook(() => useReadTracker('p10'))
    expect(mockTracker.startReading).toHaveBeenCalledWith('p10')
  })

  it('calls stopReading on unmount', async () => {
    const mockTracker = await getMockTracker()
    const { unmount } = renderHook(() => useReadTracker('p10'))
    unmount()
    expect(mockTracker.stopReading).toHaveBeenCalledWith('p10')
  })

  it('does NOT call startReading when active=false', async () => {
    const mockTracker = await getMockTracker()
    mockTracker.startReading.mockClear()
    renderHook(() => useReadTracker('p10', false))
    expect(mockTracker.startReading).not.toHaveBeenCalled()
  })

  it('does NOT call stopReading on unmount when active=false', async () => {
    const mockTracker = await getMockTracker()
    mockTracker.stopReading.mockClear()
    const { unmount } = renderHook(() => useReadTracker('p10', false))
    unmount()
    expect(mockTracker.stopReading).not.toHaveBeenCalled()
  })
})

// ─── usePageView ──────────────────────────────────────────────────────────────
describe('usePageView', () => {
  it('calls tracker.pageView with the pageName on mount', async () => {
    const mockTracker = await getMockTracker()
    mockTracker.pageView.mockClear()
    renderHook(() => usePageView('feed'))
    expect(mockTracker.pageView).toHaveBeenCalledWith('feed')
  })

  it('calls tracker.pageLeave on unmount', async () => {
    const mockTracker = await getMockTracker()
    mockTracker.pageLeave.mockClear()
    const { unmount } = renderHook(() => usePageView('feed'))
    unmount()
    expect(mockTracker.pageLeave).toHaveBeenCalled()
  })

  it('re-calls pageView when pageName changes', async () => {
    const mockTracker = await getMockTracker()
    mockTracker.pageView.mockClear()
    const { rerender } = renderHook(({ name }) => usePageView(name), {
      initialProps: { name: 'page-a' },
    })
    expect(mockTracker.pageView).toHaveBeenCalledWith('page-a')
    rerender({ name: 'page-b' })
    expect(mockTracker.pageView).toHaveBeenCalledWith('page-b')
  })
})

// ─── withTrackClick ────────────────────────────────────────────────────────────
describe('withTrackClick', () => {
  it('returns a function', async () => {
    const fn = vi.fn()
    const wrapped = withTrackClick(fn, 'p1')
    expect(typeof wrapped).toBe('function')
  })

  it('calls the original function with all arguments', async () => {
    const fn = vi.fn()
    const wrapped = withTrackClick(fn, 'p1')
    wrapped('arg1', 'arg2')
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('calls tracker.postClick with postId and extra data', async () => {
    const mockTracker = await getMockTracker()
    mockTracker.postClick.mockClear()
    const fn = vi.fn()
    const extra = { position: 3 }
    const wrapped = withTrackClick(fn, 'p42', extra)
    wrapped()
    expect(mockTracker.postClick).toHaveBeenCalledWith('p42', extra)
  })

  it('returns the original function return value', async () => {
    const fn = vi.fn(() => 'result')
    const wrapped = withTrackClick(fn, 'p1')
    expect(wrapped()).toBe('result')
  })
})

// ─── trackAction ──────────────────────────────────────────────────────────────
describe('trackAction', () => {
  it('calls tracker.actionClick with action, postId, and extra', async () => {
    const mockTracker = await getMockTracker()
    mockTracker.actionClick.mockClear()
    trackAction('like', 'p5', { confirmed: true })
    expect(mockTracker.actionClick).toHaveBeenCalledWith('like', 'p5', { confirmed: true })
  })

  it('works with minimal arguments (no extra)', async () => {
    const mockTracker = await getMockTracker()
    mockTracker.actionClick.mockClear()
    trackAction('repost', 'p6')
    expect(mockTracker.actionClick).toHaveBeenCalledWith('repost', 'p6', {})
  })
})
