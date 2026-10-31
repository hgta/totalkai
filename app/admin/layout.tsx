/**
 * /admin 的外层壳，不含守卫。
 * 守卫放在 app/admin/(protected)/layout.tsx，
 * 使 /admin/login 不受守卫影响，避免重定向死循环。
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>
}
