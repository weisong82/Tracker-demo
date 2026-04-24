import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageView, tracker } from '../hooks/useTracker'
import PostCard from '../components/PostCard'
import { posts } from '../data/mock'
import './FeedPage.css'

const tabs = ['推荐', '关注', '热门']

export default function FeedPage() {
  const [activeTab, setActiveTab] = useState('推荐')
  const [searchText, setSearchText] = useState('')
  const navigate = useNavigate()

  // 追踪页面浏览
  usePageView('feed')

  const handlePostClick = useCallback((postId) => {
    navigate(`/post/${postId}`)
  }, [navigate])

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab)
    tracker.track('tab_change', { from: activeTab, to: tab, page: 'feed' })
  }, [activeTab])

  const handleSearch = useCallback(() => {
    if (searchText.trim()) {
      tracker.search(searchText.trim(), 0)
    }
  }, [searchText])

  const handleRefresh = useCallback(() => {
    tracker.track('action_click', { action: 'refresh', source: 'feed' })
    alert('刷新成功（模拟）')
  }, [])

  return (
    <div className="feed-page">
      <div className="feed-main">
        {/* Tab 导航 */}
        <div className="feed-tabs">
          {tabs.map(tab => (
            <button
              key={tab}
              className={`feed-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => handleTabChange(tab)}
            >
              {tab}
            </button>
          ))}
          <button className="feed-refresh" onClick={handleRefresh}>🔄</button>
        </div>

        {/* 发微博框 */}
        <div className="compose-box">
          <div className="compose-avatar">😎</div>
          <div className="compose-input-wrap">
            <input
              type="text"
              placeholder="有什么新鲜事想告诉大家？"
              className="compose-input"
            />
            <button className="compose-btn">发布</button>
          </div>
        </div>

        {/* 帖子列表 */}
        <div className="feed-list">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onPostClick={handlePostClick}
            />
          ))}
        </div>

        {/* 加载更多 */}
        <div className="feed-loading">
          <button className="load-more-btn" onClick={() => tracker.track('action_click', { action: 'load_more', page: 'feed' })}>
            加载更多
          </button>
        </div>
      </div>

      {/* 侧边栏 */}
      <div className="feed-sidebar">
        <div className="sidebar-card">
          <h3>🔥 热搜榜</h3>
          <div className="trending-list">
            {['国产大模型评测', '两会重要决议', '冰岛极光', '北京隐藏面馆', '前端性能优化'].map((item, i) => (
              <div key={i} className="trending-item" onClick={() => {
                tracker.search(item, 0)
                setSearchText(item)
              }}>
                <span className={`trending-rank ${i < 3 ? 'hot' : ''}`}>{i + 1}</span>
                <span className="trending-text">{item}</span>
                {i < 2 && <span className="trending-badge">热</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-card tracker-hint">
          <h3>📡 统计追踪中</h3>
          <p>当前页面已启用行为追踪，所有交互都会被记录：</p>
          <ul>
            <li>✅ 页面停留时长</li>
            <li>✅ 帖子曝光检测</li>
            <li>✅ 点击行为追踪</li>
            <li>✅ 滚动深度追踪</li>
            <li>✅ Tab切换记录</li>
          </ul>
          <a href="/dashboard" className="view-dashboard">查看统计看板 →</a>
        </div>
      </div>
    </div>
  )
}
