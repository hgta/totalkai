import { z } from 'zod'

/**
 * 启动期环境变量校验。任何必需变量缺失或非法都会立即抛出，
 * 避免在运行期因配置问题产生难以定位的异常。
 */
const envSchema = z.object({
  DATABASE_PATH: z.string().min(1),
  SITE_URL: z.url(),
  ADMIN_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(16),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`环境变量缺失或非法: ${detail}`)
  }
  return parsed.data
}

let cached: Env | null = null

export function getEnv(): Env {
  if (!cached) {
    cached = loadEnv()
  }
  return cached
}
