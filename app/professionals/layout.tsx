import PatientPortalShell from '@/components/patient-portal/PatientPortalShell'

export default function ProfessionalsLayout({ children }: { children: React.ReactNode }) {
  return <PatientPortalShell>{children}</PatientPortalShell>
}
