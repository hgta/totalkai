import { describe, expect, it } from 'vitest'

describe('运行环境', () => {
  it('Node 主版本号不低于 20', () => {
    expect(Number(process.versions.node.split('.')[0])).toBeGreaterThanOrEqual(20)
  })
})
