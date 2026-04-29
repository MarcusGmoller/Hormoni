import PatientPortalShell from '@/components/patient-portal/PatientPortalShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <PatientPortalShell>{children}</PatientPortalShell>
}
