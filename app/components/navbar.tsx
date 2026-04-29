'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Forside' },
  { href: '/professionals', label: 'Gynaekologer' },
  { href: '/userdashboard', label: 'Dashboard' },
  { href: '/health-log', label: 'Helbred log' },
  { href: '/login', label: 'Log ind' },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {navItems.map((item) => {
        const isActive = isActivePath(pathname, item.href)

        return (
          <Link
            key={item.href}
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
