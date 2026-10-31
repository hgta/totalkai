import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import './globals.css'

const siteUrl = process.env.SITE_URL ?? 'https://totalk.ai'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'totalk.ai · 中文 AI 购物助手评测平台',
    template: '%s · totalk.ai',
  },
  description:
    'totalk.ai 聚焦中文 AI 购物助手的专业评测：评测方法论、指标解读、助手档案评分卡与横向对比。',
  openGraph: {
    type: 'website',
    siteName: 'totalk.ai',
    title: 'totalk.ai · 中文 AI 购物助手评测平台',
    description: '评测方法论、指标解读、助手档案评分卡与横向对比。',
    url: siteUrl,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
