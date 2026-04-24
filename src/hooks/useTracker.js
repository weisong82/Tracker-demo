import React from 'react'
import { createTracker, EventType } from '../tracker'

const tracker = createTracker()

// 自定义 Hook: 曝光追踪
export function useExposure(postId) {
  const ref = React.useRef(null)

  React.useEffect(() => {
    const el = ref.current
    if (el && postId) {
      tracker.observeExposure(el, postId)
    }
    return () => {
      if (el) {
        tracker.unobserveExposure(el)
      }
    }
  }, [postId])

  return ref
}

// 自定义 Hook: 阅读停留追踪
export function useReadTracker(postId, active = true) {
  React.useEffect(() => {
    if (active && postId) {
      tracker.startReading(postId)
      return () => {
        tracker.stopReading(postId)
      }
    }
  }, [postId, active])
}

// 自定义 Hook: 页面停留追踪
export function usePageView(pageName) {
  React.useEffect(() => {
    tracker.pageView(pageName)
    return () => {
      tracker.pageLeave()
    }
  }, [pageName])
}

// 点击追踪高阶函数
export function withTrackClick(fn, postId, extra = {}) {
  return (...args) => {
    tracker.postClick(postId, extra)
    return fn(...args)
  }
}

// 行为点击追踪
export function trackAction(action, postId, extra = {}) {
  tracker.actionClick(action, postId, extra)
}

export { tracker, EventType }
