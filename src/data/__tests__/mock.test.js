import { describe, it, expect } from 'vitest'
import { users, posts, comments, dashboardStats } from '../mock.js'

describe('mock data', () => {
  describe('users', () => {
    it('exports an array of users', () => {
      expect(Array.isArray(users)).toBe(true)
      expect(users.length).toBeGreaterThan(0)
    })

    it('each user has required fields: id, name, avatar, verified', () => {
      for (const user of users) {
        expect(user).toHaveProperty('id')
        expect(user).toHaveProperty('name')
        expect(user).toHaveProperty('avatar')
        expect(user).toHaveProperty('verified')
        expect(typeof user.id).toBe('string')
        expect(typeof user.name).toBe('string')
        expect(typeof user.verified).toBe('boolean')
      }
    })

    it('verified users have a verifiedType of "media" or "org"', () => {
      const verifiedUsers = users.filter(u => u.verified)
      for (const user of verifiedUsers) {
        expect(['media', 'org']).toContain(user.verifiedType)
      }
    })

    it('unverified users do not have verifiedType', () => {
      const unverified = users.filter(u => !u.verified)
      for (const user of unverified) {
        expect(user.verifiedType).toBeUndefined()
      }
    })

    it('all user ids are unique', () => {
      const ids = users.map(u => u.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('posts', () => {
    it('exports an array of posts', () => {
      expect(Array.isArray(posts)).toBe(true)
      expect(posts.length).toBeGreaterThan(0)
    })

    it('each post has required fields', () => {
      for (const post of posts) {
        expect(post).toHaveProperty('id')
        expect(post).toHaveProperty('user')
        expect(post).toHaveProperty('content')
        expect(post).toHaveProperty('images')
        expect(post).toHaveProperty('reposts')
        expect(post).toHaveProperty('comments')
        expect(post).toHaveProperty('likes')
        expect(post).toHaveProperty('createdAt')
        expect(post).toHaveProperty('isHot')
        expect(post).toHaveProperty('tags')
      }
    })

    it('each post has numeric engagement counts', () => {
      for (const post of posts) {
        expect(typeof post.reposts).toBe('number')
        expect(typeof post.comments).toBe('number')
        expect(typeof post.likes).toBe('number')
        expect(post.reposts).toBeGreaterThanOrEqual(0)
        expect(post.comments).toBeGreaterThanOrEqual(0)
        expect(post.likes).toBeGreaterThanOrEqual(0)
      }
    })

    it('each post references a valid user', () => {
      const userIds = new Set(users.map(u => u.id))
      for (const post of posts) {
        expect(userIds.has(post.user.id)).toBe(true)
      }
    })

    it('all post ids are unique', () => {
      const ids = posts.map(p => p.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('post images is always an array', () => {
      for (const post of posts) {
        expect(Array.isArray(post.images)).toBe(true)
      }
    })

    it('post tags is always an array', () => {
      for (const post of posts) {
        expect(Array.isArray(post.tags)).toBe(true)
      }
    })

    it('isHot is a boolean', () => {
      for (const post of posts) {
        expect(typeof post.isHot).toBe('boolean')
      }
    })
  })

  describe('comments', () => {
    it('exports an array of comments', () => {
      expect(Array.isArray(comments)).toBe(true)
      expect(comments.length).toBeGreaterThan(0)
    })

    it('each comment has id, user, content, likes, createdAt', () => {
      for (const comment of comments) {
        expect(comment).toHaveProperty('id')
        expect(comment).toHaveProperty('user')
        expect(comment).toHaveProperty('content')
        expect(comment).toHaveProperty('likes')
        expect(comment).toHaveProperty('createdAt')
        expect(typeof comment.likes).toBe('number')
      }
    })

    it('all comment ids are unique', () => {
      const ids = comments.map(c => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('dashboardStats', () => {
    it('exports dashboardStats object', () => {
      expect(typeof dashboardStats).toBe('object')
      expect(dashboardStats).not.toBeNull()
    })

    it('overview has required numeric fields', () => {
      const { overview } = dashboardStats
      expect(typeof overview.totalEvents).toBe('number')
      expect(typeof overview.pageViews).toBe('number')
      expect(typeof overview.avgStayDuration).toBe('number')
      expect(typeof overview.avgReadDuration).toBe('number')
      expect(typeof overview.clickRate).toBe('number')
      expect(typeof overview.exposureRate).toBe('number')
    })

    it('clickRate and exposureRate are between 0 and 1', () => {
      const { clickRate, exposureRate } = dashboardStats.overview
      expect(clickRate).toBeGreaterThanOrEqual(0)
      expect(clickRate).toBeLessThanOrEqual(1)
      expect(exposureRate).toBeGreaterThanOrEqual(0)
      expect(exposureRate).toBeLessThanOrEqual(1)
    })

    it('topPosts is an array with postId, views, clicks fields', () => {
      expect(Array.isArray(dashboardStats.topPosts)).toBe(true)
      for (const tp of dashboardStats.topPosts) {
        expect(tp).toHaveProperty('postId')
        expect(tp).toHaveProperty('views')
        expect(tp).toHaveProperty('clicks')
      }
    })

    it('hourlyActive has 24 entries', () => {
      expect(dashboardStats.hourlyActive).toHaveLength(24)
    })

    it('hourlyActive entries are all numbers', () => {
      for (const count of dashboardStats.hourlyActive) {
        expect(typeof count).toBe('number')
      }
    })

    it('eventDistribution contains expected event types', () => {
      const { eventDistribution } = dashboardStats
      expect(eventDistribution).toHaveProperty('page_view')
      expect(eventDistribution).toHaveProperty('post_click')
      expect(eventDistribution).toHaveProperty('post_exposure')
      expect(eventDistribution).toHaveProperty('post_read')
      expect(eventDistribution).toHaveProperty('action_click')
      expect(eventDistribution).toHaveProperty('scroll_depth')
    })
  })
})
