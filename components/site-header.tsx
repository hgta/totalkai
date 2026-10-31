'use client'

import Link from 'next/link'
import { useState } from 'react'

interface NavItem {
  href: string
  label: string
  ready: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '首页', ready: true },
  { href: '/wiki', label: '评测知识库', ready: false },
  { href: '/assistants', label: '助手档案', ready: false },
  { href: '/reviews', label: '评测文章', ready: false },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="border-b border-slate-200">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          totalk<span className="text-slate-400">.ai</span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="切换导航菜单"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm md:hidden"
        >
          菜单
        </button>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) =>
            item.ready ? (
              <Link key={item.href} href={item.href} className="text-sm text-slate-700 hover:text-slate-900">
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                title="即将上线"
                aria-disabled="true"
                className="cursor-not-allowed text-sm text-slate-400"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
      </div>

      {open ? (
        <nav className="border-t border-slate-200 px-4 py-3 md:hidden">
          <ul className="flex flex-col gap-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                {item.ready ? (
                  <Link href={item.href} className="text-sm text-slate-700">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-disabled="true" className="text-sm text-slate-400">
                    {item.label}（即将上线）
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
