'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/app/components/navbar'

export default function ConditionalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMarketingShell = pathname === '/' || pathname === '/viden' || pathname === '/priser'

  if (isMarketingShell) {
    return <>{children}</>
  }

  return (
    <>
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <span className="text-lg font-semibold text-slate-900">Mit Produkt</span>
          <Navbar />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </>
  )
}
