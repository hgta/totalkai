import type { PublishStatus } from './db/schema'

/**
 * 发布状态机。合法流转仅四种，其余一律抛错，
 * 避免内容被绕过审核直接发布。
 */
const TRANSITIONS: Record<PublishStatus, readonly PublishStatus[]> = {
  draft: ['in-review'],
  'in-review': ['published', 'draft'],
  published: ['draft'],
}

export function canTransition(from: PublishStatus, to: PublishStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: PublishStatus, to: PublishStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`非法的发布状态流转: ${from} -> ${to}`)
  }
}

export function isPublished(status: PublishStatus): boolean {
  return status === 'published'
}

export function applyTransition(
  current: { status: PublishStatus; updatedAt: number },
  to: PublishStatus,
  now: number,
): { status: PublishStatus; updatedAt: number } {
  assertTransition(current.status, to)
  return { status: to, updatedAt: now }
}
