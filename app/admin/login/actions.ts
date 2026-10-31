'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifyPassword,
} from '@/lib/admin-session'
import { getEnv } from '@/lib/env'

export async function login(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '')
  const { ADMIN_PASSWORD, SESSION_SECRET } = getEnv()

  if (!verifyPassword(password, ADMIN_PASSWORD)) {
    redirect('/admin/login?error=1')
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, signSession(SESSION_SECRET), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })

  redirect('/admin')
}
