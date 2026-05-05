'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Booking sker fra /professionals (vælg tid → informationsboks → Book denne tid).
 * Gamle /book/...-links omdirigeres hertil.
 */
export default function BookProfessionalRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/professionals')
  }, [router])

  return (
    <div className="mx-auto max-w-xl p-6 text-sm text-slate-600">
      Omdirigerer til listen over gynækologer…
    </div>
  )
}
