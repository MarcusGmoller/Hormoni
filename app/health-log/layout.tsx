import PatientPortalShell from '@/components/patient-portal/PatientPortalShell'

export default function HealthLogLayout({ children }: { children: React.ReactNode }) {
  return <PatientPortalShell>{children}</PatientPortalShell>
}
