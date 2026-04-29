import PatientPortalShell from '@/components/patient-portal/PatientPortalShell'

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <PatientPortalShell>{children}</PatientPortalShell>
}
