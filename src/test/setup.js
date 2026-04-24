import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback
    this.options = options
    this.observedElements = new Set()
  }
  observe(el) {
    this.observedElements.add(el)
  }
  unobserve(el) {
    this.observedElements.delete(el)
  }
  disconnect() {
    this.observedElements.clear()
  }
  // Helper to simulate intersection
  trigger(entries) {
    this.callback(entries, this)
  }
}

global.IntersectionObserver = MockIntersectionObserver

// Mock navigator.sendBeacon
Object.defineProperty(global.navigator, 'sendBeacon', {
  value: vi.fn(() => true),
  writable: true,
  configurable: true,
})

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
)

// Mock requestIdleCallback
global.requestIdleCallback = vi.fn((cb) => {
  cb({ didTimeout: false, timeRemaining: () => 50 })
  return 1
})
global.cancelIdleCallback = vi.fn()

// Silence console.error for prop-type warnings in tests
const originalError = console.error
beforeEach(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Warning:')) return
    originalError(...args)
  }
  vi.clearAllMocks()
})

afterEach(() => {
  console.error = originalError
  localStorage.clear()
})
