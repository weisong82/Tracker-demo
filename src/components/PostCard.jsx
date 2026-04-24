import React from 'react'
import { useExposure, withTrackClick, trackAction } from '../hooks/useTracker'
import './PostCard.css'

export default function PostCard({ post, onPostClick }) {
  const exposureRef = useExposure(post.id)

  const handleClick = withTrackClick(() => {
    onPostClick(post.id)
  }, post.id, { source: 'feed' })

  const handleRepost = (e) => {
    e.stopPropagation()
    trackAction('repost', post.id)
    alert('转发功能演示')
  }

  const handleComment = (e) => {
    e.stopPropagation()
    trackAction('comment', post.id)
    onPostClick(post.id)
  }

  const handleLike = (e) => {
    e.stopPropagation()
    trackAction('like', post.id)
  }

  const formatNum = (num) => {
    if (num >= 10000) return (num / 10000).toFixed(1) + '万'
    if (num >= 1000) return (num / 1000).toFixed(1) + '千'
    return num
  }

  return (
    <div className="post-card" ref={exposureRef} onClick={handleClick}>
      {post.isHot && <div className="post-hot-tag">🔥 热门</div>}
      
      <div className="post-header">
        <div className="post-avatar">{post.user.avatar}</div>
        <div className="post-user-info">
          <div className="post-user-name">
            {post.user.name}
            {post.user.verified && (
              <span className={`verified-badge ${post.user.verifiedType || ''}`}>
                {post.user.verifiedType === 'media' ? '媒' : 'V'}
              </span>
            )}
          </div>
          <div className="post-time">{post.createdAt}</div>
        </div>
      </div>

      <div className="post-content">
        <p>{post.content}</p>
        {post.images.length > 0 && (
          <div className={`post-images grid-${Math.min(post.images.length, 3)}`}>
            {post.images.map((img, i) => (
              <div key={i} className="post-image-placeholder">{img}</div>
            ))}
          </div>
        )}
        {post.tags.length > 0 && (
          <div className="post-tags">
            {post.tags.map((tag, i) => (
              <span key={i} className="post-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="post-actions">
        <button className="action-btn" onClick={handleRepost}>
          <span className="action-icon">🔁</span>
          <span>{formatNum(post.reposts)}</span>
        </button>
        <button className="action-btn" onClick={handleComment}>
          <span className="action-icon">💬</span>
          <span>{formatNum(post.comments)}</span>
        </button>
        <button className="action-btn" onClick={handleLike}>
          <span className="action-icon">❤️</span>
          <span>{formatNum(post.likes)}</span>
        </button>
      </div>
    </div>
  )
}
