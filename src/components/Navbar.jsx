import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
  const location = useLocation()

  const isActive = (path) => location.pathname === path ? 'nav-active' : ''

  return (
    <nav className="navbar">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">
          <span className="nav-logo">📌</span>
          <span className="nav-title">微博</span>
        </Link>

        <div className="nav-links">
          <Link to="/" className={`nav-link ${isActive('/')}`}>
            <span className="nav-icon">🏠</span>首页
          </Link>
          <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>
            <span className="nav-icon">📊</span>统计看板
          </Link>
        </div>

        <div className="nav-search">
          <input type="text" placeholder="搜索微博" className="search-input" />
        </div>

        <div className="nav-user">
          <span className="nav-avatar-sm">😎</span>
        </div>
      </div>
    </nav>
  )
}
