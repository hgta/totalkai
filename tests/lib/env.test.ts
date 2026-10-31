import { describe, expect, it } from 'vitest'
import { loadEnv } from '@/lib/env'

const base = {
  DATABASE_PATH: '/tmp/test.db',
  SITE_URL: 'https://totalk.ai',
  ADMIN_PASSWORD: 'password123',
  SESSION_SECRET: 'a'.repeat(32),
}

describe('loadEnv', () => {
  it('变量完整时返回解析结果', () => {
    expect(loadEnv(base)).toMatchObject({ SITE_URL: 'https://totalk.ai' })
  })

  it('缺少 DATABASE_PATH 时抛错并指明变量名', () => {
    const { DATABASE_PATH: _omitted, ...rest } = base
    expect(() => loadEnv(rest)).toThrow(/DATABASE_PATH/)
  })

  it('SITE_URL 非法时抛错', () => {
    expect(() => loadEnv({ ...base, SITE_URL: 'not-a-url' })).toThrow(/SITE_URL/)
  })

  it('PORT 缺省为 3000', () => {
    expect(loadEnv(base).PORT).toBe(3000)
  })

  it('SESSION_SECRET 短于 16 位时抛错', () => {
    expect(() => loadEnv({ ...base, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/)
  })
})
