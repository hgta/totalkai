import { describe, expect, it } from 'vitest'
import { SESSION_COOKIE, signSession, verifyPassword, verifySession } from '@/lib/admin-session'

const secret = 'test-secret-at-least-16-chars'
const otherSecret = 'another-secret-at-least-16'

describe('管理会话', () => {
  it('Cookie 名称为常量', () => {
    expect(SESSION_COOKIE).toBe('totalk_admin')
  })

  it('签发的 token 可被校验通过', () => {
    expect(verifySession(signSession(secret), secret)).toBe(true)
  })

  it('密钥不同则校验失败', () => {
    expect(verifySession(signSession(secret), otherSecret)).toBe(false)
  })

  it('被篡改的 token 校验失败', () => {
    const token = signSession(secret)
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(verifySession(tampered, secret)).toBe(false)
  })

  it('缺失或空 token 校验失败', () => {
    expect(verifySession(undefined, secret)).toBe(false)
    expect(verifySession('', secret)).toBe(false)
    expect(verifySession('no-separator', secret)).toBe(false)
  })
})

describe('口令校验', () => {
  it('正确口令通过', () => {
    expect(verifyPassword('password123', 'password123')).toBe(true)
  })

  it('错误口令不通过', () => {
    expect(verifyPassword('password124', 'password123')).toBe(false)
  })

  it('长度不同的口令不通过', () => {
    expect(verifyPassword('short', 'password123')).toBe(false)
  })
})
