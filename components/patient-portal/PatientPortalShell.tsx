'use client'

import { ReactNode, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isAdminProfileRole, useProfileRole } from '@/lib/useProfileRole'
import styles from './patientPortalShell.module.css'

/** Offentlige patient-flows: admin må gerne besøge uden at blive sendt til /admin. */
function allowAdminOnPath(pathname: string | null): boolean {
  if (!pathname) return false
  return pathname.startsWith('/book') || pathname.startsWith('/professionals')
}

export default function PatientPortalShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { loading, role } = useProfileRole()
  const adminBypass = allowAdminOnPath(pathname)

  useEffect(() => {
    if (adminBypass || loading) return
    if (isAdminProfileRole(role)) {
      router.replace('/admin')
    }
  }, [adminBypass, loading, role, router])

  if (!adminBypass && !loading && isAdminProfileRole(role)) {
    return (
      <div className={styles.page}>
        <p className="text-sm text-neutral-600">Omdirigerer til admin…</p>
      </div>
    )
  }

  return <div className={styles.page}>{children}</div>
}
