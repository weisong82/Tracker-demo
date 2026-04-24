import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '../DashboardPage.jsx'

vi.mock('../../hooks/useTracker', () => ({
  tracker: { track: vi.fn(), pageView: vi.fn(), pageLeave: vi.fn() },
  usePageView: vi.fn(),
  useExposure: vi.fn(() => ({ current: null })),
  withTrackClick: vi.fn((fn) => fn),
  trackAction: vi.fn(),
  EventType: {},
}))

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  )

describe('DashboardPage', () => {
  describe('rendering', () => {
    it('renders the 统计看板 header', () => {
      renderDashboard()
      expect(screen.getByText('📊 统计看板')).toBeInTheDocument()
    })

    it('renders the subtitle', () => {
      renderDashboard()
      expect(screen.getByText('用户行为追踪数据实时展示')).toBeInTheDocument()
    })

    it('renders all 6 metric cards', () => {
      renderDashboard()
      expect(screen.getByText('总事件数')).toBeInTheDocument()
      expect(screen.getByText('页面浏览')).toBeInTheDocument()
      expect(screen.getByText('点击次数')).toBeInTheDocument()
      expect(screen.getByText('曝光次数')).toBeInTheDocument()
      expect(screen.getByText('平均停留')).toBeInTheDocument()
      expect(screen.getByText('平均阅读')).toBeInTheDocument()
    })

    it('renders the event type distribution panel', () => {
      renderDashboard()
      expect(screen.getByText('📈 事件类型分布')).toBeInTheDocument()
    })

    it('renders the live event stream panel', () => {
      renderDashboard()
      expect(screen.getByText(/实时事件流/)).toBeInTheDocument()
    })

    it('renders the SDK architecture panel', () => {
      renderDashboard()
      expect(screen.getByText('🏗️ 统计SDK架构')).toBeInTheDocument()
    })

    it('renders the performance strategy panel', () => {
      renderDashboard()
      expect(screen.getByText('⚡ 性能策略')).toBeInTheDocument()
    })

    it('renders the tracking capability table', () => {
      renderDashboard()
      expect(screen.getByText('📋 追踪能力')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows 暂无事件数据 when no events are in localStorage', () => {
      localStorage.clear()
      renderDashboard()
      expect(screen.getByText('暂无事件数据')).toBeInTheDocument()
    })
  })

  describe('live events from localStorage', () => {
    it('displays stored events loaded from localStorage', () => {
      const storedEvents = [
        {
          id: 'e1',
          type: 'page_view',
          sessionId: 's1',
          timestamp: Date.now(),
          page: 'feed',
          data: { page: 'feed' },
        },
      ]
      localStorage.setItem('wb_dashboard_events', JSON.stringify(storedEvents))
      renderDashboard()
      // Event stream should show the event label (getAllByText handles multiple occurrences)
      expect(screen.getAllByText('📄 页面浏览').length).toBeGreaterThan(0)
    })

    it('shows event page label in event stream', () => {
      const storedEvents = [
        {
          id: 'e2',
          type: 'post_click',
          sessionId: 's1',
          timestamp: Date.now(),
          page: 'feed',
          data: { postId: 'p1', page: 'feed' },
        },
      ]
      localStorage.setItem('wb_dashboard_events', JSON.stringify(storedEvents))
      renderDashboard()
      expect(screen.getAllByText('👆 帖子点击').length).toBeGreaterThan(0)
    })

    it('updates live events when tracker-update custom event fires', () => {
      renderDashboard()
      const newEvents = [
        {
          id: 'e3',
          type: 'search',
          sessionId: 's1',
          timestamp: Date.now(),
          page: 'feed',
          data: {},
        },
      ]
      act(() => {
        window.dispatchEvent(new CustomEvent('tracker-update', { detail: newEvents }))
      })
      expect(screen.getAllByText('🔍 搜索').length).toBeGreaterThan(0)
    })
  })

  describe('formatDuration helper', () => {
    it('shows formatted avg stay duration from page_stay events', () => {
      const storedEvents = [
        {
          id: 'e10',
          type: 'page_stay',
          sessionId: 's1',
          timestamp: Date.now(),
          page: 'feed',
          data: { duration: 3000 },
        },
      ]
      localStorage.setItem('wb_dashboard_events', JSON.stringify(storedEvents))
      renderDashboard()
      // 3000ms = 3s; check the average stay card specifically
      const stayCard = screen.getByText('平均停留').closest('.dash-card')
      expect(stayCard).toHaveTextContent('3s')
    })

    it('shows 0ms for avg stay when no page_stay events', () => {
      localStorage.clear()
      renderDashboard()
      // Both avg stay and avg read should show 0ms
      const zeros = screen.getAllByText('0ms')
      expect(zeros.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('eventCounts and metric cards', () => {
    it('shows correct total event count', () => {
      const storedEvents = Array.from({ length: 5 }, (_, i) => ({
        id: `e${i}`,
        type: 'page_view',
        sessionId: 's1',
        timestamp: Date.now(),
        data: {},
      }))
      localStorage.setItem('wb_dashboard_events', JSON.stringify(storedEvents))
      renderDashboard()
      // The total count card should show 5
      const totalCard = screen.getByText('总事件数').closest('.dash-card')
      expect(totalCard).toHaveTextContent('5')
    })

    it('counts page_view events for 页面浏览 metric', () => {
      const storedEvents = [
        { id: 'e1', type: 'page_view', sessionId: 's1', timestamp: Date.now(), data: {} },
        { id: 'e2', type: 'page_view', sessionId: 's1', timestamp: Date.now(), data: {} },
        { id: 'e3', type: 'post_click', sessionId: 's1', timestamp: Date.now(), data: {} },
      ]
      localStorage.setItem('wb_dashboard_events', JSON.stringify(storedEvents))
      renderDashboard()
      // page views metric card should show 2
      const pageViewCard = screen.getByText('页面浏览').closest('.dash-card')
      expect(pageViewCard).toHaveTextContent('2')
    })
  })
})
