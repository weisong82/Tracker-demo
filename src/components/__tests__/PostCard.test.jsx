import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PostCard from '../PostCard.jsx'

// Mock the tracker hooks so PostCard renders without real tracker side-effects
vi.mock('../../hooks/useTracker', () => ({
  useExposure: vi.fn(() => ({ current: null })),
  withTrackClick: vi.fn((fn) => fn), // pass-through
  trackAction: vi.fn(),
}))

const basePost = {
  id: 'p1',
  user: { id: 'u1', name: '人民日报', avatar: '🔴', verified: true, verifiedType: 'media' },
  content: '测试内容',
  images: [],
  video: null,
  reposts: 100,
  comments: 50,
  likes: 200,
  createdAt: '10分钟前',
  isHot: false,
  tags: [],
}

describe('PostCard', () => {
  describe('rendering', () => {
    it('renders the post content', () => {
      render(<PostCard post={basePost} onPostClick={vi.fn()} />)
      expect(screen.getByText('测试内容')).toBeInTheDocument()
    })

    it('renders the user name', () => {
      render(<PostCard post={basePost} onPostClick={vi.fn()} />)
      expect(screen.getByText('人民日报')).toBeInTheDocument()
    })

    it('renders the creation time', () => {
      render(<PostCard post={basePost} onPostClick={vi.fn()} />)
      expect(screen.getByText('10分钟前')).toBeInTheDocument()
    })

    it('renders the user avatar', () => {
      render(<PostCard post={basePost} onPostClick={vi.fn()} />)
      expect(screen.getByText('🔴')).toBeInTheDocument()
    })

    it('renders verified badge with 媒 for media type', () => {
      render(<PostCard post={basePost} onPostClick={vi.fn()} />)
      expect(screen.getByText('媒')).toBeInTheDocument()
    })

    it('renders verified badge with V for org type', () => {
      const post = {
        ...basePost,
        user: { ...basePost.user, verifiedType: 'org' },
      }
      render(<PostCard post={post} onPostClick={vi.fn()} />)
      expect(screen.getByText('V')).toBeInTheDocument()
    })

    it('does not render a verified badge for unverified users', () => {
      const post = {
        ...basePost,
        user: { ...basePost.user, verified: false },
      }
      render(<PostCard post={post} onPostClick={vi.fn()} />)
      expect(screen.queryByText('媒')).not.toBeInTheDocument()
      expect(screen.queryByText('V')).not.toBeInTheDocument()
    })

    it('renders 🔥 热门 tag when post.isHot is true', () => {
      const post = { ...basePost, isHot: true }
      render(<PostCard post={post} onPostClick={vi.fn()} />)
      expect(screen.getByText('🔥 热门')).toBeInTheDocument()
    })

    it('does not render hot tag when isHot is false', () => {
      render(<PostCard post={basePost} onPostClick={vi.fn()} />)
      expect(screen.queryByText('🔥 热门')).not.toBeInTheDocument()
    })

    it('renders all post tags', () => {
      const post = { ...basePost, tags: ['#前端#', '#React#'] }
      render(<PostCard post={post} onPostClick={vi.fn()} />)
      expect(screen.getByText('#前端#')).toBeInTheDocument()
      expect(screen.getByText('#React#')).toBeInTheDocument()
    })

    it('renders image placeholders when images are present', () => {
      const post = { ...basePost, images: ['📊', '📈'] }
      render(<PostCard post={post} onPostClick={vi.fn()} />)
      expect(screen.getByText('📊')).toBeInTheDocument()
      expect(screen.getByText('📈')).toBeInTheDocument()
    })

    it('does not render image section when images array is empty', () => {
      const { container } = render(<PostCard post={basePost} onPostClick={vi.fn()} />)
      expect(container.querySelector('.post-images')).not.toBeInTheDocument()
    })
  })

  describe('number formatting', () => {
    it('formats numbers ≥ 10000 as 万', () => {
      const post = { ...basePost, likes: 52600 }
      render(<PostCard post={post} onPostClick={vi.fn()} />)
      expect(screen.getByText('5.3万')).toBeInTheDocument()
    })

    it('formats numbers ≥ 1000 as 千', () => {
      const post = { ...basePost, likes: 1500 }
      render(<PostCard post={post} onPostClick={vi.fn()} />)
      expect(screen.getByText('1.5千')).toBeInTheDocument()
    })

    it('displays numbers < 1000 as-is', () => {
      render(<PostCard post={basePost} onPostClick={vi.fn()} />)
      // likes=200, comments=50, reposts=100
      expect(screen.getByText('200')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onPostClick with postId when card is clicked', async () => {
      const onPostClick = vi.fn()
      const { container } = render(<PostCard post={basePost} onPostClick={onPostClick} />)
      await userEvent.click(container.querySelector('.post-card'))
      expect(onPostClick).toHaveBeenCalledWith('p1')
    })

    it('calls trackAction with "repost" when repost button is clicked', async () => {
      const { trackAction } = await import('../../hooks/useTracker')
      const { container } = render(<PostCard post={basePost} onPostClick={vi.fn()} />)
      const repostBtn = container.querySelector('.action-btn')
      await userEvent.click(repostBtn)
      expect(trackAction).toHaveBeenCalledWith('repost', 'p1')
    })

    it('calls trackAction with "comment" when comment button is clicked', async () => {
      const { trackAction } = await import('../../hooks/useTracker')
      const onPostClick = vi.fn()
      const { getAllByRole } = render(<PostCard post={basePost} onPostClick={onPostClick} />)
      const buttons = getAllByRole('button')
      // comment button is 2nd (index 1)
      await userEvent.click(buttons[1])
      expect(trackAction).toHaveBeenCalledWith('comment', 'p1')
    })

    it('navigates to the post on comment button click', async () => {
      const onPostClick = vi.fn()
      const { getAllByRole } = render(<PostCard post={basePost} onPostClick={onPostClick} />)
      const buttons = getAllByRole('button')
      await userEvent.click(buttons[1])
      expect(onPostClick).toHaveBeenCalledWith('p1')
    })

    it('calls trackAction with "like" when like button is clicked', async () => {
      const { trackAction } = await import('../../hooks/useTracker')
      const { getAllByRole } = render(<PostCard post={basePost} onPostClick={vi.fn()} />)
      const buttons = getAllByRole('button')
      // like button is 3rd (index 2)
      await userEvent.click(buttons[2])
      expect(trackAction).toHaveBeenCalledWith('like', 'p1')
    })

    it('repost button click does not propagate to card (no navigation)', async () => {
      const onPostClick = vi.fn()
      const { container } = render(<PostCard post={basePost} onPostClick={onPostClick} />)
      const repostBtn = container.querySelector('.action-btn')
      await userEvent.click(repostBtn)
      // onPostClick should NOT be called because stopPropagation is used
      expect(onPostClick).not.toHaveBeenCalled()
    })
  })
})
