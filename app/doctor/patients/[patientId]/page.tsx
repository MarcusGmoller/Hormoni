import { Suspense } from 'react'
import PatientDetailClient from './PatientDetailClient'

export default function PatientDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-neutral-600">
          Indlæser…
        </div>
      }
    >
      <PatientDetailClient />
    </Suspense>
  )
}
