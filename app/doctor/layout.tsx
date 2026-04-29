import { Suspense, type ReactNode } from 'react'
import DoctorLayoutClient from './DoctorLayoutClient'

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-8 text-sm text-neutral-600">
          Indlæser…
        </div>
      }
    >
      <DoctorLayoutClient>{children}</DoctorLayoutClient>
    </Suspense>
  )
}
