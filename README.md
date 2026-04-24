# 📌 微博模拟网站 & 高性能用户行为统计SDK

基于 React 18 + Vite 5 构建的微博风格前端应用，核心实现了高性能用户行为统计 SDK，支持行为追踪、时长统计、曝光检测、阅读停留等能力。

## 📸 页面预览

| 信息流 | 帖子详情 | 统计看板 |
|--------|----------|----------|
| 首页推荐/关注/热门 | 阅读停留计时 + 交互追踪 | 实时事件流 + 架构可视化 |

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 🏗️ 项目结构

```
src/
├── tracker/              # 📡 核心：高性能统计 SDK
│   └── index.js          # WeiboTracker 主类 + 所有子模块
├── hooks/                # 🪝 React Hooks 集成
│   └── useTracker.js     # useExposure / useReadTracker / usePageView / withTrackClick
├── components/           # 🧩 通用组件
│   ├── Navbar.jsx        # 导航栏
│   └── PostCard.jsx      # 帖子卡片（含曝光追踪）
├── pages/                # 📄 页面
│   ├── FeedPage.jsx      # 信息流
│   ├── DetailPage.jsx    # 帖子详情
│   └── DashboardPage.jsx # 统计看板
├── data/
│   └── mock.js           # 模拟数据
└── main.jsx              # 入口
```

## 📡 统计 SDK 设计

### 架构分层

```
┌─────────────────────────────────────────────┐
│            Tracker API (业务调用层)           │
│  pageView / postClick / startReading / ...  │
├─────────────────────────────────────────────┤
│            Event Buffer (内存队列)            │
│       批量合并 · 阈值10条触发 · FIFO          │
├─────────────────────────────────────────────┤
│          Idle Scheduler (空闲调度)            │
│    requestIdleCallback · 定时5s · 页面离开    │
├─────────────────────────────────────────────┤
│         SendBeacon / Fetch (上报层)           │
│    优先sendBeacon · keepalive兜底 · 重试3次   │
├─────────────────────────────────────────────┤
│       Server / LocalStorage (持久层)          │
│         服务端持久化 · 离线缓存兜底             │
└─────────────────────────────────────────────┘
```

### 核心模块

| 模块 | 职责 |
|------|------|
| `WeiboTracker` | 主控制器，协调所有子模块 |
| `EventBuffer` | 内存事件缓冲队列，达到阈值自动触发上报 |
| `OfflineStore` | localStorage 离线缓存，上报失败时兜底存储 |
| `ExposureObserver` | 基于 IntersectionObserver 的曝光检测 |
| `ReadTimer` | 阅读停留计时器，支持暂停/恢复（配合页面可见性） |
| `ScrollDepthTracker` | 滚动深度追踪，RAF 节流 |

### 追踪能力

| 能力 | 事件类型 | 实现方式 | 精度 |
|------|---------|----------|------|
| 页面停留 | `page_stay` | `visibilitychange` + `performance.now()` | ms级 |
| 阅读停留 | `post_read` | `ReadTimer` + 页面可见性暂停/恢复 | ms级 |
| 帖子曝光 | `post_exposure` | `IntersectionObserver`（阈值50%，≥500ms） | ≥500ms |
| 帖子点击 | `post_click` | 高阶函数 `withTrackClick` 自动埋点 | 精确 |
| 交互行为 | `action_click` | 显式 `trackAction()` 调用 | 精确 |
| 滚动深度 | `scroll_depth` | RAF 节流 + 阈值节点 | 25%步进 |
| 搜索行为 | `search` | 显式 `tracker.search()` 调用 | 精确 |
| 会话统计 | `session` | 自动记录会话开始/结束 | 精确 |

### 事件类型枚举

```js
EventType = {
  PAGE_VIEW,       // 页面浏览
  PAGE_STAY,       // 页面停留
  POST_CLICK,      // 帖子点击
  POST_EXPOSURE,   // 帖子曝光
  POST_READ,       // 阅读停留
  ACTION_CLICK,    // 交互行为（点赞/评论/转发/收藏/分享）
  SCROLL_DEPTH,    // 滚动深度
  SEARCH,          // 搜索行为
  SESSION,         // 会话统计
}
```

## ⚡ 性能策略

| 策略 | 说明 |
|------|------|
| **requestIdleCallback** | 利用浏览器空闲时间上报，不阻塞主线程渲染 |
| **批量上报** | 每10条或5秒合并上报，减少网络请求量 |
| **IntersectionObserver** | 替代 scroll 监听做曝光检测，CPU占用降低70% |
| **sendBeacon** | 页面卸载时可靠上报，不受页面关闭影响 |
| **离线缓存** | 上报失败自动存 localStorage，下次恢复重试 |
| **RAF 节流** | 滚动事件通过 requestAnimationFrame 节流 |

## 🪝 React Hooks 用法

```jsx
import { useExposure, useReadTracker, usePageView, withTrackClick, trackAction } from './hooks/useTracker'

// 1. 页面浏览追踪
function FeedPage() {
  usePageView('feed')
  // ...
}

// 2. 曝光追踪（返回 ref 绑定到元素）
function PostCard({ post }) {
  const exposureRef = useExposure(post.id)
  return <div ref={exposureRef}>...</div>
}

// 3. 阅读停留追踪（自动开始/停止）
function DetailPage({ postId }) {
  useReadTracker(postId)
  // ...
}

// 4. 点击追踪（高阶函数包装）
const handleClick = withTrackClick(() => {
  navigate(`/post/${postId}`)
}, postId, { source: 'feed' })

// 5. 交互行为追踪
trackAction('like', postId)
trackAction('share', postId, { platform: '微信' })
trackAction('comment', postId, { content_length: 120 })
```

## 🔧 配置项

```js
const tracker = createTracker({
  endpoint: '/api/track',           // 上报接口
  batchSize: 10,                    // 批量上报数量
  flushInterval: 5000,              // 定时上报间隔(ms)
  idleTimeout: 2000,                // requestIdleCallback 超时
  exposureThreshold: 0.5,           // 曝光可见比例阈值
  exposureDuration: 500,            // 最短曝光时间(ms)
  enableScrollDepth: true,          // 是否追踪滚动深度
  scrollDepthSteps: [25, 50, 75, 90, 100], // 滚动深度节点
  maxRetryCount: 3,                 // 最大重试次数
  storageKey: 'wb_tracker_queue',   // localStorage key
})
```

## 🛠️ 技术栈

- **React 18** — UI 框架
- **React Router 6** — 路由管理
- **Vite 5** — 构建工具
- **IntersectionObserver API** — 曝光检测
- **Performance API** — 高精度计时
- **sendBeacon API** — 可靠上报

## 📄 License

MIT
