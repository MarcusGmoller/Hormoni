import type { SupabaseClient } from '@supabase/supabase-js'

export function getConfiguredAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isAllowedAdminEmail(email: string | null | undefined) {
  if (!email) return false
  const allowed = getConfiguredAdminEmails()
  if (allowed.length === 0) return false
  return allowed.includes(email.trim().toLowerCase())
}

/**
 * Admin-adgang (admin API):
 * 1) E-mail på listen `ADMIN_EMAILS` (kommasepareret, case-insensitive), eller
 * 2) `profiles.role = 'admin'` (kræver at enum `user_role` har værdien `admin` — se migration).
 */
export async function assertAdminByBearerToken(params: {
  supabase: SupabaseClient
  jwt: string
  /** Service role-klient til at læse `profiles.role` (RLS omgås). */
  serviceRoleClient?: SupabaseClient
}): Promise<{ ok: true; userId: string; email: string | null } | { ok: false; status: number; error: string }> {
  const {
    data: { user },
    error,
  } = await params.supabase.auth.getUser(params.jwt)

  if (error || !user) {
    return { ok: false, status: 401, error: error?.message ?? 'Ugyldig eller udløbet session.' }
  }
  if (isAllowedAdminEmail(user.email)) {
    return { ok: true, userId: user.id, email: user.email ?? null }
  }

  if (params.serviceRoleClient) {
    const { data: profile, error: profileError } = await params.serviceRoleClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (!profileError && profile?.role === 'admin') {
      return { ok: true, userId: user.id, email: user.email ?? null }
    }
  }

  return { ok: false, status: 403, error: 'Kun administratorer må udføre denne handling.' }
}
