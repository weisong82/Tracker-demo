import React, { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePageView, useReadTracker, trackAction, tracker } from '../hooks/useTracker'
import { posts, comments } from '../data/mock'
import './DetailPage.css'

export default function DetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const post = posts.find(p => p.id === id)
  const [liked, setLiked] = useState(false)
  const [collected, setCollected] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [showShareMenu, setShowShareMenu] = useState(false)

  // 追踪页面浏览和阅读停留
  usePageView(`detail_${id}`)
  useReadTracker(id)

  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const handleLike = useCallback(() => {
    setLiked(!liked)
    trackAction('like', id, { action: liked ? 'unlike' : 'like' })
  }, [liked, id])

  const handleCollect = useCallback(() => {
    setCollected(!collected)
    trackAction('collect', id, { action: collected ? 'uncollect' : 'collect' })
  }, [collected, id])

  const handleShare = useCallback((platform) => {
    trackAction('share', id, { platform })
    setShowShareMenu(false)
    alert(`已分享到${platform}`)
  }, [id])

  const handleComment = useCallback(() => {
    if (commentText.trim()) {
      trackAction('comment', id, { content_length: commentText.length })
      setCommentText('')
      alert('评论已发送（模拟）')
    }
  }, [commentText, id])

  const handleCommentLike = useCallback((commentId) => {
    trackAction('comment_like', id, { commentId })
  }, [id])

  if (!post) {
    return (
      <div className="detail-page">
        <div className="detail-not-found">
          <p>😢 帖子不存在</p>
          <button onClick={handleBack}>返回首页</button>
        </div>
      </div>
    )
  }

  const formatNum = (num) => {
    if (num >= 10000) return (num / 10000).toFixed(1) + '万'
    return num.toLocaleString()
  }

  return (
    <div className="detail-page">
      <div className="detail-main">
        {/* 返回栏 */}
        <div className="detail-header">
          <button className="back-btn" onClick={handleBack}>← 返回</button>
          <span className="detail-header-title">微博正文</span>
          <span></span>
        </div>

        {/* 帖子内容 */}
        <div className="detail-post">
          <div className="detail-post-header">
            <div className="detail-avatar">{post.user.avatar}</div>
            <div className="detail-user-info">
              <div className="detail-user-name">
                {post.user.name}
                {post.user.verified && (
                  <span className={`verified-badge ${post.user.verifiedType || ''}`}>
                    {post.user.verifiedType === 'media' ? '媒' : 'V'}
                  </span>
                )}
              </div>
              <div className="detail-time">{post.createdAt} · 来自微博 weibo.com</div>
            </div>
            <button className="follow-btn">+ 关注</button>
          </div>

          <div className="detail-content">
            <p>{post.content}</p>
            {post.images.length > 0 && (
              <div className={`detail-images grid-${Math.min(post.images.length, 3)}`}>
                {post.images.map((img, i) => (
                  <div key={i} className="detail-image-placeholder">{img}</div>
                ))}
              </div>
            )}
            {post.tags.length > 0 && (
              <div className="detail-tags">
                {post.tags.map((tag, i) => (
                  <span key={i} className="detail-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* 互动数据 */}
          <div className="detail-stats">
            <span>{formatNum(post.reposts)} 转发</span>
            <span>{formatNum(post.comments)} 评论</span>
            <span>{formatNum(post.likes)} 赞</span>
          </div>

          {/* 操作栏 */}
          <div className="detail-actions">
            <div className="detail-action-group">
              <button className="detail-action-btn" onClick={() => setShowShareMenu(!showShareMenu)}>
                🔁 {formatNum(post.reposts)}
              </button>
              <button className="detail-action-btn">
                💬 {formatNum(post.comments)}
              </button>
              <button className={`detail-action-btn ${liked ? 'liked' : ''}`} onClick={handleLike}>
                {liked ? '❤️' : '🤍'} {formatNum(post.likes + (liked ? 1 : 0))}
              </button>
            </div>
            <div className="detail-action-group">
              <button className={`detail-action-btn small ${collected ? 'collected' : ''}`} onClick={handleCollect}>
                {collected ? '⭐' : '☆'} {collected ? '已收藏' : '收藏'}
              </button>
              <button className="detail-action-btn small" onClick={() => setShowShareMenu(!showShareMenu)}>
                📤 分享
              </button>
            </div>
          </div>

          {/* 分享菜单 */}
          {showShareMenu && (
            <div className="share-menu">
              <div className="share-option" onClick={() => handleShare('微信')}>💬 微信</div>
              <div className="share-option" onClick={() => handleShare('朋友圈')}>📱 朋友圈</div>
              <div className="share-option" onClick={() => handleShare('QQ')}>🐧 QQ</div>
              <div className="share-option" onClick={() => handleShare('链接复制')}>🔗 复制链接</div>
            </div>
          )}
        </div>

        {/* 评论区 */}
        <div className="detail-comments">
          <h3>评论 {formatNum(post.comments)}</h3>

          <div className="comment-input-box">
            <input
              type="text"
              placeholder="写评论..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleComment()}
            />
            <button onClick={handleComment}>发送</button>
          </div>

          <div className="comment-list">
            {comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <div className="comment-avatar">{comment.user.avatar}</div>
                <div className="comment-body">
                  <div className="comment-user">{comment.user.name}</div>
                  <div className="comment-text">{comment.content}</div>
                  <div className="comment-meta">
                    <span>{comment.createdAt}</span>
                    <button className="comment-like-btn" onClick={() => handleCommentLike(comment.id)}>
                      ❤️ {comment.likes}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 侧边栏 - 阅读追踪实时状态 */}
      <div className="detail-sidebar">
        <div className="sidebar-card read-tracker">
          <h3>📖 阅读追踪</h3>
          <div className="tracker-status">
            <div className="tracker-dot active"></div>
            <span>正在记录您的阅读停留时长...</span>
          </div>
          <p className="tracker-note">离开此页面时，阅读时长将自动上报</p>
          <ul className="tracker-events">
            <li>✅ 页面浏览记录</li>
            <li>✅ 阅读停留计时</li>
            <li>✅ 点赞/收藏/分享</li>
            <li>✅ 评论行为追踪</li>
            <li>✅ 页面离开上报</li>
          </ul>
        </div>

        <div className="sidebar-card">
          <h3>👤 作者信息</h3>
          <div className="author-card">
            <div className="author-avatar">{post.user.avatar}</div>
            <div>
              <div className="author-name">{post.user.name}</div>
              <div className="author-bio">微博认证用户</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
