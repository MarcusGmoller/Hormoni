import PatientPortalShell from '@/components/patient-portal/PatientPortalShell'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <PatientPortalShell>{children}</PatientPortalShell>
}
