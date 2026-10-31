import { describe, expect, it } from 'vitest'
import { evaluateHealth } from '@/lib/health'

describe('evaluateHealth', () => {
  it('探针为真时整体健康', () => {
    expect(evaluateHealth(() => true, 1000)).toEqual({
      status: 'ok',
      database: 'ok',
      timestamp: 1000,
    })
  })

  it('探针为假时数据库标记为不可用', () => {
    const result = evaluateHealth(() => false, 1000)
    expect(result.status).toBe('error')
    expect(result.database).toBe('error')
  })

  it('探针抛异常时数据库标记为不可用', () => {
    const result = evaluateHealth(() => {
      throw new Error('db down')
    }, 1000)
    expect(result.status).toBe('error')
    expect(result.database).toBe('error')
  })

  it('时间戳取自传入值', () => {
    expect(evaluateHealth(() => true, 42).timestamp).toBe(42)
  })
})
