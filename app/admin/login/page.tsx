import { login } from './actions'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-xl font-semibold">管理后台登录</h1>
      <p className="mt-2 text-sm text-slate-600">请输入管理口令以进入内容审核后台。</p>

      {error ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">口令错误，请重试。</p>
      ) : null}

      <form action={login} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm text-slate-700">
            管理口令
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          登录
        </button>
      </form>
    </div>
  )
}
