import React, { useState, useEffect, useCallback } from 'react'
import { usePageView, tracker } from '../hooks/useTracker'
import { dashboardStats } from '../data/mock'
import './DashboardPage.css'

export default function DashboardPage() {
  usePageView('dashboard')

  const [liveEvents, setLiveEvents] = useState([])
  const [activeTab, setActiveTab] = useState('overview')

  // 实时监听追踪事件
  useEffect(() => {
    const handler = (e) => {
      const events = e.detail || []
      setLiveEvents(prev => [...events, ...prev].slice(0, 50))
    }
    window.addEventListener('tracker-update', handler)
    return () => window.removeEventListener('tracker-update', handler)
  }, [])

  // 加载历史事件
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('wb_dashboard_events') || '[]')
      setLiveEvents(stored.slice(-50).reverse())
    } catch {
      // ignore
    }
  }, [])

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`
    const s = Math.floor(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    return `${m}m ${s % 60}s`
  }

  const formatTime = (timestamp) => {
    const d = new Date(timestamp)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  const eventTypeLabel = {
    page_view: '📄 页面浏览',
    page_stay: '⏱️ 页面停留',
    post_click: '👆 帖子点击',
    post_exposure: '👁️ 帖子曝光',
    post_read: '📖 阅读停留',
    action_click: '🖱️ 交互行为',
    scroll_depth: '📊 滚动深度',
    search: '🔍 搜索',
    session: '🔄 会话',
    tab_change: '📑 Tab切换',
  }

  // 汇总统计
  const eventCounts = liveEvents.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1
    return acc
  }, {})

  const totalEvents = liveEvents.length
  const pageViews = eventCounts.page_view || 0
  const clicks = (eventCounts.post_click || 0) + (eventCounts.action_click || 0)
  const exposures = eventCounts.post_exposure || 0

  // 平均停留时长
  const stayEvents = liveEvents.filter(e => e.type === 'page_stay')
  const avgStay = stayEvents.length > 0
    ? Math.round(stayEvents.reduce((sum, e) => sum + (e.data?.duration || 0), 0) / stayEvents.length)
    : 0

  // 阅读停留
  const readEvents = liveEvents.filter(e => e.type === 'post_read')
  const avgRead = readEvents.length > 0
    ? Math.round(readEvents.reduce((sum, e) => sum + (e.data?.duration || 0), 0) / readEvents.length)
    : 0

  // 滚动深度分布
  const scrollEvents = liveEvents.filter(e => e.type === 'scroll_depth')
  const maxScroll = scrollEvents.length > 0 ? Math.max(...scrollEvents.map(e => e.data?.depth || 0)) : 0

  return (
    <div className="dashboard-page">
      <div className="dash-header">
        <h2>📊 统计看板</h2>
        <p className="dash-subtitle">用户行为追踪数据实时展示</p>
      </div>

      {/* 概览卡片 */}
      <div className="dash-cards">
        <div className="dash-card">
          <div className="dash-card-icon">📊</div>
          <div className="dash-card-value">{totalEvents}</div>
          <div className="dash-card-label">总事件数</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-icon">📄</div>
          <div className="dash-card-value">{pageViews}</div>
          <div className="dash-card-label">页面浏览</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-icon">👆</div>
          <div className="dash-card-value">{clicks}</div>
          <div className="dash-card-label">点击次数</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-icon">👁️</div>
          <div className="dash-card-value">{exposures}</div>
          <div className="dash-card-label">曝光次数</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-icon">⏱️</div>
          <div className="dash-card-value">{formatDuration(avgStay)}</div>
          <div className="dash-card-label">平均停留</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-icon">📖</div>
          <div className="dash-card-value">{formatDuration(avgRead)}</div>
          <div className="dash-card-label">平均阅读</div>
        </div>
      </div>

      <div className="dash-content">
        {/* 左侧：事件分布 + 实时事件流 */}
        <div className="dash-main">
          {/* 事件分布图 */}
          <div className="dash-panel">
            <h3>📈 事件类型分布</h3>
            <div className="event-distribution">
              {Object.entries(eventCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="dist-row">
                  <div className="dist-label">{eventTypeLabel[type] || type}</div>
                  <div className="dist-bar-wrap">
                    <div
                      className="dist-bar"
                      style={{ width: `${Math.max(2, (count / totalEvents) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="dist-count">{count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 实时事件流 */}
          <div className="dash-panel">
            <h3>⚡ 实时事件流 <span className="live-badge">LIVE</span></h3>
            <div className="event-stream">
              {liveEvents.length === 0 ? (
                <div className="empty-state">
                  <p>暂无事件数据</p>
                  <p className="hint">请先浏览首页或帖子详情页，返回后可看到追踪数据</p>
                </div>
              ) : (
                liveEvents.slice(0, 30).map((event, i) => (
                  <div key={event.id || i} className={`event-item ${event.type}`}>
                    <div className="event-type-tag">
                      {eventTypeLabel[event.type] || event.type}
                    </div>
                    <div className="event-detail">
                      {event.data?.page && <span className="event-page">{event.data.page}</span>}
                      {event.data?.postId && <span className="event-post">帖子:{event.data.postId}</span>}
                      {event.data?.duration && <span className="event-duration">{formatDuration(event.data.duration)}</span>}
                      {event.data?.action && <span className="event-action">{event.data.action}</span>}
                      {event.data?.depth && <span className="event-depth">深度:{event.data.depth}%</span>}
                    </div>
                    <div className="event-time">{formatTime(event.timestamp)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 右侧：技术架构 + SDK 说明 */}
        <div className="dash-sidebar">
          <div className="dash-panel sdk-arch">
            <h3>🏗️ 统计SDK架构</h3>
            <div className="arch-diagram">
              <div className="arch-layer">
                <div className="arch-box primary">Tracker API</div>
                <div className="arch-desc">pageView / postClick / startReading / actionClick</div>
              </div>
              <div className="arch-arrow">▼</div>
              <div className="arch-layer">
                <div className="arch-box secondary">Event Buffer</div>
                <div className="arch-desc">内存队列 · 批量合并 · 阈值触发</div>
              </div>
              <div className="arch-arrow">▼</div>
              <div className="arch-layer">
                <div className="arch-box secondary">Idle Scheduler</div>
                <div className="arch-desc">requestIdleCallback · 定时5s · 页面离开</div>
              </div>
              <div className="arch-arrow">▼</div>
              <div className="arch-layer">
                <div className="arch-box accent">SendBeacon / Fetch</div>
                <div className="arch-desc">优先sendBeacon · keepalive兜底 · 重试3次</div>
              </div>
              <div className="arch-arrow">▼</div>
              <div className="arch-layer">
                <div className="arch-box dark">Server / LocalStorage</div>
                <div className="arch-desc">服务端持久化 · 离线缓存兜底</div>
              </div>
            </div>
          </div>

          <div className="dash-panel">
            <h3>⚡ 性能策略</h3>
            <div className="perf-list">
              <div className="perf-item">
                <span className="perf-icon">🔄</span>
                <div>
                  <div className="perf-title">requestIdleCallback</div>
                  <div className="perf-desc">利用浏览器空闲时间上报，不阻塞主线程</div>
                </div>
              </div>
              <div className="perf-item">
                <span className="perf-icon">📦</span>
                <div>
                  <div className="perf-title">批量上报</div>
                  <div className="perf-desc">每10条或5秒合并上报，减少网络请求</div>
                </div>
              </div>
              <div className="perf-item">
                <span className="perf-icon">👁️</span>
                <div>
                  <div className="perf-title">Intersection Observer</div>
                  <div className="perf-desc">高效曝光检测，替代scroll监听，CPU占用降低70%</div>
                </div>
              </div>
              <div className="perf-item">
                <span className="perf-icon">📡</span>
                <div>
                  <div className="perf-title">sendBeacon</div>
                  <div className="perf-desc">页面卸载时可靠上报，不受页面关闭影响</div>
                </div>
              </div>
              <div className="perf-item">
                <span className="perf-icon">💾</span>
                <div>
                  <div className="perf-title">离线缓存</div>
                  <div className="perf-desc">上报失败自动存localStorage，下次恢复重试</div>
                </div>
              </div>
              <div className="perf-item">
                <span className="perf-icon">🎯</span>
                <div>
                  <div className="perf-title">RAF节流</div>
                  <div className="perf-desc">滚动事件通过requestAnimationFrame节流</div>
                </div>
              </div>
            </div>
          </div>

          <div className="dash-panel">
            <h3>📋 追踪能力</h3>
            <table className="cap-table">
              <thead>
                <tr>
                  <th>能力</th>
                  <th>实现方式</th>
                  <th>精度</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>页面停留</td>
                  <td>visibilitychange + perf.now()</td>
                  <td>ms级</td>
                </tr>
                <tr>
                  <td>阅读停留</td>
                  <td>ReadTimer + 页面可见性</td>
                  <td>ms级</td>
                </tr>
                <tr>
                  <td>帖子曝光</td>
                  <td>IntersectionObserver</td>
                  <td>≥500ms</td>
                </tr>
                <tr>
                  <td>帖子点击</td>
                  <td>事件委托 + 高阶函数</td>
                  <td>精确</td>
                </tr>
                <tr>
                  <td>滚动深度</td>
                  <td>RAF + 阈值节点</td>
                  <td>25%步进</td>
                </tr>
                <tr>
                  <td>交互行为</td>
                  <td>显式调用track</td>
                  <td>精确</td>
                </tr>
                <tr>
                  <td>搜索行为</td>
                  <td>显式调用search</td>
                  <td>精确</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
