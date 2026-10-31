export type HealthStatus = 'ok' | 'error'

export interface HealthResult {
  status: HealthStatus
  database: HealthStatus
  timestamp: number
}

/** 数据库连通性探针。返回 false 或抛异常均视为不可用。 */
export type Probe = () => boolean

/**
 * 纯函数形式的健康状态计算，便于单测覆盖各种探针结果。
 * 探针注入不放在路由处理函数签名上，以符合 Next.js 对路由参数的校验约束。
 */
export function evaluateHealth(probe: Probe, now: number = Date.now()): HealthResult {
  let database: HealthStatus = 'ok'
  try {
    if (!probe()) {
      database = 'error'
    }
  } catch {
    database = 'error'
  }

  return {
    status: database === 'ok' ? 'ok' : 'error',
    database,
    timestamp: now,
  }
}
