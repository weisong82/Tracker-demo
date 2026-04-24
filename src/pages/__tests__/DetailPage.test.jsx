import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import DetailPage from '../DetailPage.jsx'

vi.mock('../../hooks/useTracker', () => {
  const mockTracker = {
    track: vi.fn(),
    pageView: vi.fn(),
    pageLeave: vi.fn(),
    actionClick: vi.fn(),
    postClick: vi.fn(),
    observeExposure: vi.fn(),
    unobserveExposure: vi.fn(),
    startReading: vi.fn(),
    stopReading: vi.fn(),
  }
  return {
    tracker: mockTracker,
    useExposure: vi.fn(() => ({ current: null })),
    usePageView: vi.fn(),
    useReadTracker: vi.fn(),
    withTrackClick: vi.fn((fn) => fn),
    trackAction: vi.fn(),
    EventType: {},
  }
})

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const renderDetail = (postId = 'p4') =>
  render(
    <MemoryRouter initialEntries={[`/post/${postId}`]}>
      <Routes>
        <Route path="/post/:id" element={<DetailPage />} />
      </Routes>
    </MemoryRouter>
  )

describe('DetailPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  describe('not found state', () => {
    it('renders 帖子不存在 when the post id is invalid', () => {
      renderDetail('nonexistent')
      expect(screen.getByText('😢 帖子不存在')).toBeInTheDocument()
    })

    it('renders a back button in not-found state', () => {
      renderDetail('nonexistent')
      expect(screen.getByRole('button', { name: /返回首页/ })).toBeInTheDocument()
    })

    it('clicking back in not-found state calls navigate(-1)', async () => {
      renderDetail('nonexistent')
      await userEvent.click(screen.getByRole('button', { name: /返回首页/ }))
      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })
  })

  describe('found state (post p4)', () => {
    it('renders the post content', () => {
      renderDetail('p4')
      expect(screen.getByText(/Intersection Observer/)).toBeInTheDocument()
    })

    it('renders 微博正文 header', () => {
      renderDetail('p4')
      expect(screen.getByText('微博正文')).toBeInTheDocument()
    })

    it('renders the back button', () => {
      renderDetail('p4')
      expect(screen.getByText('← 返回')).toBeInTheDocument()
    })

    it('clicking ← 返回 calls navigate(-1)', async () => {
      renderDetail('p4')
      await userEvent.click(screen.getByText('← 返回'))
      expect(mockNavigate).toHaveBeenCalledWith(-1)
    })

    it('renders the + 关注 button', () => {
      renderDetail('p4')
      expect(screen.getByText('+ 关注')).toBeInTheDocument()
    })

    it('renders the comment input', () => {
      renderDetail('p4')
      expect(screen.getByPlaceholderText('写评论...')).toBeInTheDocument()
    })

    it('renders the comment send button', () => {
      renderDetail('p4')
      expect(screen.getByText('发送')).toBeInTheDocument()
    })

    it('renders the reading tracker sidebar', () => {
      renderDetail('p4')
      expect(screen.getByText('📖 阅读追踪')).toBeInTheDocument()
    })

    it('renders the author info sidebar', () => {
      renderDetail('p4')
      expect(screen.getByText('👤 作者信息')).toBeInTheDocument()
    })
  })

  describe('like / collect toggle', () => {
    it('like button starts with 🤍', () => {
      renderDetail('p4')
      // Find the like button (third action button in the group)
      const likeBtn = screen.getAllByRole('button').find(b => b.textContent.includes('🤍'))
      expect(likeBtn).toBeInTheDocument()
    })

    it('clicking like toggles to ❤️', async () => {
      renderDetail('p4')
      const likeBtn = screen.getAllByRole('button').find(b => b.textContent.includes('🤍'))
      await userEvent.click(likeBtn)
      expect(screen.getAllByRole('button').some(b => b.textContent.includes('❤️'))).toBe(true)
    })

    it('calls trackAction with "like" when liked', async () => {
      const { trackAction } = await import('../../hooks/useTracker')
      trackAction.mockClear()
      renderDetail('p4')
      const likeBtn = screen.getAllByRole('button').find(b => b.textContent.includes('🤍'))
      await userEvent.click(likeBtn)
      expect(trackAction).toHaveBeenCalledWith('like', 'p4', expect.objectContaining({ action: 'like' }))
    })

    it('collect button starts with ☆', () => {
      renderDetail('p4')
      const collectBtn = screen.getAllByRole('button').find(b => b.textContent.includes('☆'))
      expect(collectBtn).toBeInTheDocument()
    })

    it('clicking collect toggles to ⭐', async () => {
      renderDetail('p4')
      const collectBtn = screen.getAllByRole('button').find(b => b.textContent.includes('☆'))
      await userEvent.click(collectBtn)
      expect(screen.getAllByRole('button').some(b => b.textContent.includes('⭐'))).toBe(true)
    })
  })

  describe('share menu', () => {
    it('share menu is hidden initially', () => {
      renderDetail('p4')
      expect(screen.queryByText('💬 微信')).not.toBeInTheDocument()
    })

    it('clicking 📤 分享 shows the share menu', async () => {
      renderDetail('p4')
      await userEvent.click(screen.getByText('📤 分享'))
      expect(screen.getByText('💬 微信')).toBeInTheDocument()
    })

    it('share menu contains expected platforms', async () => {
      renderDetail('p4')
      await userEvent.click(screen.getByText('📤 分享'))
      expect(screen.getByText('💬 微信')).toBeInTheDocument()
      expect(screen.getByText('📱 朋友圈')).toBeInTheDocument()
      expect(screen.getByText('🐧 QQ')).toBeInTheDocument()
      expect(screen.getByText('🔗 复制链接')).toBeInTheDocument()
    })
  })

  describe('comment input', () => {
    it('sends comment on pressing Enter in comment input', async () => {
      renderDetail('p4')
      const input = screen.getByPlaceholderText('写评论...')
      await userEvent.type(input, '好文章')
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
      // Alert is called (simulated) and input cleared
      expect(input).toHaveValue('')
    })

    it('does not send empty comment', async () => {
      const { trackAction } = await import('../../hooks/useTracker')
      trackAction.mockClear()
      renderDetail('p4')
      await userEvent.click(screen.getByText('发送'))
      expect(trackAction).not.toHaveBeenCalledWith('comment', expect.anything(), expect.anything())
    })
  })

  describe('formatNum', () => {
    it('shows reposts/comments/likes using 万 for large numbers (post p6 has 34500 likes)', () => {
      renderDetail('p6')
      expect(screen.getAllByText(/万/).length).toBeGreaterThan(0)
    })
  })
})
