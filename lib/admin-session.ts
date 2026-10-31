import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'totalk_admin'

/** 会话有效期：12 小时 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

export function signSession(secret: string, issuedAt: number = Date.now()): string {
  const payload = Buffer.from(String(issuedAt)).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifySession(token: string | undefined, secret: string): boolean {
  if (!token) {
    return false
  }
  const [payload, signature] = token.split('.')
  if (!payload || !signature) {
    return false
  }
  const expected = createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    return false
  }
  return timingSafeEqual(a, b)
}

export function verifyPassword(input: string, expected: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    return false
  }
  return timingSafeEqual(a, b)
}
