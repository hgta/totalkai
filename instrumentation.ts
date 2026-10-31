/**
 * 应用启动时执行数据库迁移。
 * 服务器只运行 standalone 产物（不含 tsx），因此迁移放在启动期而非部署脚本里。
 * 迁移幂等，重复执行不产生变更；迁移失败会让进程退出，从而被部署健康检查捕获并触发回滚。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  const { getDb } = await import('./lib/db/client')
  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')

  try {
    migrate(getDb(), { migrationsFolder: process.env.MIGRATIONS_FOLDER ?? './drizzle' })
  } catch (error) {
    console.error('数据库迁移失败', error)
    throw error
  }
}
