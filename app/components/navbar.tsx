'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSupabaseUser } from '@/lib/useSupabaseUser'
import { isAdminProfileRole, useProfileRole } from '@/lib/useProfileRole'

const patientNavItems = [
  { href: '/', label: 'Forside' },
  { href: '/professionals', label: 'Gynaekologer' },
  { href: '/userdashboard', label: 'Dashboard' },
  { href: '/health-log', label: 'Helbred log' },
  { href: '/debug-db', label: 'Debug DB' },
]

const adminNavItems = [
  { href: '/', label: 'Forside' },
  { href: '/admin', label: 'Admin' },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Navbar() {
  const pathname = usePathname()
  const user = useSupabaseUser()
  const { loading: roleLoading, role } = useProfileRole()
  const isAdmin = isAdminProfileRole(role)

  let navItems: { href: string; label: string }[]

  if (user && !roleLoading && isAdmin) {
    navItems = [...adminNavItems, { href: '/logout', label: 'Log ud' }]
  } else if (user) {
    navItems = [...patientNavItems, { href: '/dashboard', label: 'Mit dashboard' }]
  } else {
    navItems = [...patientNavItems, { href: '/login', label: 'Log ind' }]
  }

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {navItems.map((item) => {
        const isActive = isActivePath(pathname, item.href)

        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className={[
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-black text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-black',
            ].join(' ')}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
