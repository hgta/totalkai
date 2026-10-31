import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { evaluateHealth } from '@/lib/health'

export const dynamic = 'force-dynamic'

/**
 * 健康检查端点。
 * 部署脚本在切换版本后轮询此端点，数据库不可用时返回 503 以触发自动回滚。
 */
export async function GET(): Promise<NextResponse> {
  const result = evaluateHealth(() => {
    getDb().get(sql`select 1 as ok`)
    return true
  })

  return NextResponse.json(result, { status: result.status === 'ok' ? 200 : 503 })
}
