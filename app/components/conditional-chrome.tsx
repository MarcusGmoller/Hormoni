'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Navbar from '@/app/components/navbar'

function AppChrome({ children }: { children: React.ReactNode }) {
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

/** Kun for /userdashboard/subscription — kræver Suspense pga. useSearchParams. */
function SubscriptionChromeGate({ children }: { children: React.ReactNode }) {
  const setupMode = useSearchParams().get('setup') === '1'
  if (setupMode) {
    return <>{children}</>
  }
  return <AppChrome>{children}</AppChrome>
}

export default function ConditionalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const hideAppChromeStatic =
    pathname === '/' ||
    pathname === '/viden' ||
    pathname === '/priser' ||
    pathname === '/onboarding' ||
    pathname === '/gynaekolog-onboarding' ||
    pathname === '/login' ||
    pathname === '/auth/confirm'

  if (hideAppChromeStatic) {
    return <>{children}</>
  }

  if (pathname === '/userdashboard/subscription') {
    return (
      <Suspense fallback={<AppChrome>{children}</AppChrome>}>
        <SubscriptionChromeGate>{children}</SubscriptionChromeGate>
      </Suspense>
    )
  }

  return <AppChrome>{children}</AppChrome>
}
