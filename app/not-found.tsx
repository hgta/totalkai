import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-3xl font-semibold">404</p>
      <p className="mt-2 text-sm text-slate-600">页面不存在，或内容尚未发布。</p>
      <Link href="/" className="mt-6 inline-block text-sm text-slate-900 underline">
        返回首页
      </Link>
    </div>
  )
}
