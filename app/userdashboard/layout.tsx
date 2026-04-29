import PatientPortalShell from '@/components/patient-portal/PatientPortalShell'

export default function UserDashboardLayout({ children }: { children: React.ReactNode }) {
  return <PatientPortalShell>{children}</PatientPortalShell>
}
