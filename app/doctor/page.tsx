import { Suspense } from 'react'
import DoctorPageClient from './DoctorPageClient'

export const dynamic = 'force-dynamic'

export default function DoctorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center p-8 text-sm text-neutral-600">
          Indlæser…
        </div>
      }
    >
      <DoctorPageClient />
    </Suspense>
  )
}
