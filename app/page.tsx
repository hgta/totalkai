import { EmptyState } from '@/components/empty-state'
import { getDb } from '@/lib/db/client'
import { listPublishedContent } from '@/lib/queries'

// 内容在请求时读取，构建期不依赖数据库
export const dynamic = 'force-dynamic'

const COMPASS_DIMENSIONS = [
  '需求澄清',
  '商品检索准确性',
  '价格与优惠计算',
  '时效与库存真实性',
  '决策质量',
  '安全与合规',
  '多轮与个性化',
  '链路完成度',
  '引用可溯源',
]

async function loadContent() {
  try {
    return await listPublishedContent(getDb())
  } catch {
    // 数据库不可用时降级为空列表，页面仍需正常返回 200
    return []
  }
}

export default async function HomePage() {
  const items = await loadContent()

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">中文 AI 购物助手评测平台</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          totalk.ai 聚焦「AI 购物助手怎么评」与「评出来是什么」：沉淀评测方法论与指标解读，
          维护 AI 购物助手档案与评分卡，并提供可复核的横向对比与深度评测文章。
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">评测罗盘（九维度）</h2>
        <p className="mt-2 text-sm text-slate-600">
          平台的每一条评分都基于这套维度体系，逐维度给出评分口径与证据。
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {COMPASS_DIMENSIONS.map((dimension) => (
            <li
              key={dimension}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {dimension}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">最新内容</h2>
        <div className="mt-4">
          {items.length === 0 ? (
            <EmptyState
              title="还没有已发布的内容"
              description="内容需经人工审核后才会出现在这里。"
            />
          ) : (
            <ul className="divide-y divide-slate-200">
              {items.map((item) => (
                <li key={item.id} className="py-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.type} · /{item.slug}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
