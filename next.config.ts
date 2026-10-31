import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // standalone 产物需包含迁移文件，启动期 instrumentation 会执行迁移
  outputFileTracingIncludes: {
    '/**': ['./drizzle/**/*'],
  },
}

export default nextConfig
