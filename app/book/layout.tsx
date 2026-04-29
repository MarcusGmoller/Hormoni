import PatientPortalShell from '@/components/patient-portal/PatientPortalShell'

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <PatientPortalShell>{children}</PatientPortalShell>
}
