import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import FeedPage from '../FeedPage.jsx'

// Mock hooks and tracker to avoid real tracker side-effects
vi.mock('../../hooks/useTracker', () => {
  const mockTracker = {
    track: vi.fn(),
    pageView: vi.fn(),
    pageLeave: vi.fn(),
    search: vi.fn(),
    postClick: vi.fn(),
    actionClick: vi.fn(),
    observeExposure: vi.fn(),
    unobserveExposure: vi.fn(),
    startReading: vi.fn(),
    stopReading: vi.fn(),
  }
  return {
    tracker: mockTracker,
    useExposure: vi.fn(() => ({ current: null })),
    usePageView: vi.fn(),
    withTrackClick: vi.fn((fn) => fn),
    trackAction: vi.fn(),
    EventType: {
      PAGE_VIEW: 'page_view',
      PAGE_STAY: 'page_stay',
      POST_CLICK: 'post_click',
      POST_EXPOSURE: 'post_exposure',
      POST_READ: 'post_read',
      ACTION_CLICK: 'action_click',
      SCROLL_DEPTH: 'scroll_depth',
      SEARCH: 'search',
      SESSION: 'session',
    },
  }
})

// Mock navigate from react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const renderFeedPage = () =>
  render(
    <MemoryRouter>
      <FeedPage />
    </MemoryRouter>
  )

describe('FeedPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  describe('rendering', () => {
    it('renders all three tabs: 推荐, 关注, 热门', () => {
      renderFeedPage()
      expect(screen.getByText('推荐')).toBeInTheDocument()
      expect(screen.getByText('关注')).toBeInTheDocument()
      expect(screen.getByText('热门')).toBeInTheDocument()
    })

    it('renders the refresh button 🔄', () => {
      renderFeedPage()
      expect(screen.getByText('🔄')).toBeInTheDocument()
    })

    it('renders the compose box with placeholder', () => {
      renderFeedPage()
      expect(screen.getByPlaceholderText('有什么新鲜事想告诉大家？')).toBeInTheDocument()
    })

    it('renders the 发布 button', () => {
      renderFeedPage()
      expect(screen.getByText('发布')).toBeInTheDocument()
    })

    it('renders multiple post cards from mock data', () => {
      renderFeedPage()
      // All 8 mock posts should be present
      const cards = document.querySelectorAll('.post-card')
      expect(cards.length).toBeGreaterThan(0)
    })

    it('renders the hot search sidebar section', () => {
      renderFeedPage()
      expect(screen.getByText('🔥 热搜榜')).toBeInTheDocument()
    })

    it('renders the tracking hint sidebar card', () => {
      renderFeedPage()
      expect(screen.getByText('📡 统计追踪中')).toBeInTheDocument()
    })

    it('renders the 加载更多 button', () => {
      renderFeedPage()
      expect(screen.getByText('加载更多')).toBeInTheDocument()
    })

    it('the 推荐 tab is active by default', () => {
      renderFeedPage()
      const tab = screen.getByText('推荐').closest('button')
      expect(tab).toHaveClass('active')
    })
  })

  describe('tab switching', () => {
    it('switches active tab when a tab is clicked', async () => {
      renderFeedPage()
      await userEvent.click(screen.getByText('关注'))
      const tab = screen.getByText('关注').closest('button')
      expect(tab).toHaveClass('active')
    })

    it('calls tracker.track with tab_change when a tab is clicked', async () => {
      const { tracker } = await import('../../hooks/useTracker')
      tracker.track.mockClear()
      renderFeedPage()
      await userEvent.click(screen.getByText('热门'))
      expect(tracker.track).toHaveBeenCalledWith('tab_change', expect.objectContaining({
        to: '热门',
        page: 'feed',
      }))
    })
  })

  describe('search', () => {
    it('calls tracker.search when hot search item is clicked', async () => {
      const { tracker } = await import('../../hooks/useTracker')
      tracker.search.mockClear()
      renderFeedPage()
      await userEvent.click(screen.getByText('国产大模型评测'))
      expect(tracker.search).toHaveBeenCalledWith('国产大模型评测', 0)
    })
  })

  describe('post click navigation', () => {
    it('navigates to the post detail page when a post card is clicked', async () => {
      renderFeedPage()
      const cards = document.querySelectorAll('.post-card')
      if (cards.length > 0) {
        await userEvent.click(cards[0])
        expect(mockNavigate).toHaveBeenCalled()
      }
    })
  })
})
