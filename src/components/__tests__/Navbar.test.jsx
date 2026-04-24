import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '../Navbar.jsx'

const renderNavbar = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Navbar />
    </MemoryRouter>
  )

describe('Navbar', () => {
  it('renders the brand title 微博', () => {
    renderNavbar()
    expect(screen.getByText('微博')).toBeInTheDocument()
  })

  it('renders the brand logo 📌', () => {
    renderNavbar()
    expect(screen.getByText('📌')).toBeInTheDocument()
  })

  it('renders the 首页 navigation link', () => {
    renderNavbar()
    expect(screen.getByText('首页')).toBeInTheDocument()
  })

  it('renders the 统计看板 navigation link', () => {
    renderNavbar()
    expect(screen.getByText('统计看板')).toBeInTheDocument()
  })

  it('renders the search input with correct placeholder', () => {
    renderNavbar()
    expect(screen.getByPlaceholderText('搜索微博')).toBeInTheDocument()
  })

  it('renders the user avatar', () => {
    renderNavbar()
    expect(screen.getByText('😎')).toBeInTheDocument()
  })

  it('the 首页 link points to /', () => {
    renderNavbar()
    const homeLink = screen.getByRole('link', { name: /首页/ })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('the 统计看板 link points to /dashboard', () => {
    renderNavbar()
    const dashLink = screen.getByRole('link', { name: /统计看板/ })
    expect(dashLink).toHaveAttribute('href', '/dashboard')
  })

  it('adds nav-active class to 首页 link when on / route', () => {
    renderNavbar('/')
    const homeLink = screen.getByRole('link', { name: /首页/ })
    expect(homeLink).toHaveClass('nav-active')
  })

  it('does NOT add nav-active class to 统计看板 when on / route', () => {
    renderNavbar('/')
    const dashLink = screen.getByRole('link', { name: /统计看板/ })
    expect(dashLink).not.toHaveClass('nav-active')
  })

  it('adds nav-active class to 统计看板 link when on /dashboard route', () => {
    renderNavbar('/dashboard')
    const dashLink = screen.getByRole('link', { name: /统计看板/ })
    expect(dashLink).toHaveClass('nav-active')
  })

  it('does NOT add nav-active class to 首页 when on /dashboard route', () => {
    renderNavbar('/dashboard')
    const homeLink = screen.getByRole('link', { name: /首页/ })
    expect(homeLink).not.toHaveClass('nav-active')
  })

  it('neither link is active on an unrelated route', () => {
    renderNavbar('/post/p1')
    const homeLink = screen.getByRole('link', { name: /首页/ })
    const dashLink = screen.getByRole('link', { name: /统计看板/ })
    expect(homeLink).not.toHaveClass('nav-active')
    expect(dashLink).not.toHaveClass('nav-active')
  })
})
