'use client'

import Link from 'next/link'
import { useSupabaseUser } from '@/lib/useSupabaseUser'
import { isAdminProfileRole, useProfileRole } from '@/lib/useProfileRole'

const sageBtn = 'bg-[#849b87] hover:bg-[#738a7a]'

export type MarketingNavPage = 'home' | 'viden' | 'priser'

type MarketingSiteHeaderProps = {
  /** På undersider: brug `"/"` så anchor-links peger på forsiden (fx `/#om`). */
  anchorBase?: string
  currentPage?: MarketingNavPage
}

export default function MarketingSiteHeader({
  anchorBase = '',
  currentPage = 'home',
}: MarketingSiteHeaderProps) {
  const hash = (id: string) => `${anchorBase}#${id}`
  const user = useSupabaseUser()
  const { loading: roleLoading, role } = useProfileRole()
  const isAdmin = Boolean(user && !roleLoading && isAdminProfileRole(role))
  const dashboardHref = isAdmin ? '/admin' : '/dashboard'
  const dashboardLabel = isAdmin ? 'Admin dashboard' : 'Mit dashboard'

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex items-center justify-between gap-4 lg:justify-start">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[#333333]">
            Hormoni(e)
          </Link>
          {user ? (
            <Link
              href={dashboardHref}
              className={`rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition lg:hidden ${sageBtn}`}
            >
              {dashboardLabel}
            </Link>
          ) : (
            <Link
              href="/login"
              className={`rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition lg:hidden ${sageBtn}`}
            >
              Start
            </Link>
          )}
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-medium text-[#4a4a4a] lg:flex-1">
          <a href={hash('om')} className="transition hover:text-[#333333]">
            Om Hormoni(e)
          </a>
          <a href={hash('saadan')} className="transition hover:text-[#333333]">
            Sådan fungerer det
          </a>
          {currentPage === 'viden' ? (
            <span className="font-semibold text-[#333333]" aria-current="page">
              Viden
            </span>
          ) : (
            <Link href="/viden" className="transition hover:text-[#333333]">
              Viden
            </Link>
          )}
          <Link href="/community" className="transition hover:text-[#333333]">
            Community
          </Link>
          {currentPage === 'priser' ? (
            <span className="font-semibold text-[#333333]" aria-current="page">
              Priser
            </span>
          ) : (
            <a
              href="/priser"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-[#333333]"
            >
              Priser
            </a>
          )}
          {user ? (
            <Link href={dashboardHref} className="transition hover:text-[#333333]">
              {dashboardLabel}
            </Link>
          ) : (
            <Link href="/login" className="transition hover:text-[#333333]">
              Log ind
            </Link>
          )}
        </nav>
        {user ? (
          <Link
            href={dashboardHref}
            className={`hidden rounded-full px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition lg:inline-flex ${sageBtn}`}
          >
            {dashboardLabel}
          </Link>
        ) : (
          <Link
            href="/login"
            className={`hidden rounded-full px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition lg:inline-flex ${sageBtn}`}
          >
            Start dit forløb
          </Link>
        )}
      </div>
    </header>
  )
}
