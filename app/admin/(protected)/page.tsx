import { EmptyState } from '@/components/empty-state'

export const dynamic = 'force-dynamic'

export default function AdminHomePage() {
  return (
    <div className="py-8">
      <h1 className="text-xl font-semibold">内容审核</h1>
      <p className="mt-2 text-sm text-slate-600">
        内容需经审核通过后才对前台可见。草稿与待审内容会出现在这里。
      </p>
      <div className="mt-6">
        <EmptyState
          title="暂无待审内容"
          description="后续的评测知识库、助手档案与评测文章会在此接入各自的审核队列。"
        />
      </div>
    </div>
  )
}
