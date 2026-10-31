import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySession } from '@/lib/admin-session'
import { getEnv } from '@/lib/env'

/** 未持有有效会话时重定向到登录页。 */
export default async function AdminGuardLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  const { SESSION_SECRET } = getEnv()

  if (!verifySession(token, SESSION_SECRET)) {
    redirect('/admin/login')
  }

  return <>{children}</>
}
