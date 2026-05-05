/**
 * Ensartet routing efter login for gynækologer (kilde: public.professionals).
 */
export type ProfessionalForRouting = {
  approval_status: string
  bio?: string | null
  professional_name?: string | null
  payment_information?: string | null
  professional_email?: string | null
  professional_phone?: string | null
} | null

export function routeByProfessionalState(professional: ProfessionalForRouting): string {
  if (!professional) return '/gynaekolog-onboarding'
  if (professional.approval_status === 'approved') return '/gynaekolog-dashboard'
  if (
    !professional.bio?.trim() ||
    !professional.professional_name?.trim() ||
    !professional.payment_information?.trim() ||
    !professional.professional_email?.trim() ||
    !professional.professional_phone?.trim()
  ) {
    return '/gynaekolog-onboarding'
  }
  return '/gynaekolog-pending'
}

/** Bagudkompat: både ?role= og ?selected_role= (Supabase bevarer typisk hele redirectTo-URL). */
export function roleFromCallbackSearchParams(searchParams: URLSearchParams): 'user' | 'professional' {
  const raw = (searchParams.get('role') ?? searchParams.get('selected_role') ?? '').toLowerCase()
  return raw === 'professional' ? 'professional' : 'user'
}
