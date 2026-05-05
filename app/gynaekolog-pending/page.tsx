'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isAdminProfileRole, useProfileRole } from '@/lib/useProfileRole'

export default function GynekologPendingPage() {
  const router = useRouter()
  const { loading, role } = useProfileRole()

  useEffect(() => {
    if (loading) return
    if (isAdminProfileRole(role)) router.replace('/admin')
  }, [loading, role, router])

  if (!loading && isAdminProfileRole(role)) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <p className="text-sm text-gray-600">Omdirigerer til admin…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Profil afventer godkendelse</h1>
        <p className="mb-4 text-sm text-gray-700">
          Din professionelle profil er oprettet som <strong>pending</strong>. En admin skal godkende den,
          før du kan bruge gynækolog-dashboardet.
        </p>
      </div>
    </main>
  )
}