import { describe, expect, it } from 'vitest'
import {
  applyTransition,
  assertTransition,
  canTransition,
  isPublished,
} from '@/lib/content-status'

describe('发布状态机', () => {
  it('draft 可提交为 in-review', () => {
    expect(canTransition('draft', 'in-review')).toBe(true)
  })

  it('draft 不可直接变为 published', () => {
    expect(canTransition('draft', 'published')).toBe(false)
    expect(() => assertTransition('draft', 'published')).toThrow(/draft -> published/)
  })

  it('in-review 可通过或打回', () => {
    expect(canTransition('in-review', 'published')).toBe(true)
    expect(canTransition('in-review', 'draft')).toBe(true)
  })

  it('published 可下架为 draft', () => {
    expect(canTransition('published', 'draft')).toBe(true)
  })

  it('published 不可回到 in-review', () => {
    expect(canTransition('published', 'in-review')).toBe(false)
  })

  it('applyTransition 更新状态与时间戳', () => {
    const next = applyTransition({ status: 'draft', updatedAt: 1 }, 'in-review', 2)
    expect(next).toEqual({ status: 'in-review', updatedAt: 2 })
  })

  it('applyTransition 对非法流转抛错且不修改状态', () => {
    const current = { status: 'draft' as const, updatedAt: 1 }
    expect(() => applyTransition(current, 'published', 2)).toThrow()
    expect(current).toEqual({ status: 'draft', updatedAt: 1 })
  })

  it('isPublished 仅对 published 为真', () => {
    expect(isPublished('published')).toBe(true)
    expect(isPublished('draft')).toBe(false)
    expect(isPublished('in-review')).toBe(false)
  })
})
