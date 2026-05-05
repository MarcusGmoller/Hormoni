import type { SupabaseClient } from '@supabase/supabase-js'

/** Matcher Supabase `User` felter vi behøver til profiles-sync (undgår cirkulær import). */
export type AuthUserSync = { id: string; email?: string | null }

export type EnsureProfileOptions = {
  /**
   * Hvilken slags login der kører (gynækolog vs bruger). Påvirker ikke `profiles.role` fra klienten:
   * - Klienten indsætter altid `role: 'user'` (undgår "Role can only be changed by admin").
   * - `professional` sættes af `handle_new_user`, admin eller SQL — ikke af browser-update.
   * Gynækolog findes i `public.professionals`; se migration der fjerner krav om `profiles.role`.
   */
  intendedRole?: 'user' | 'professional'
}

/**
 * Holder `public.profiles` i trit med Supabase Auth (`auth.users`):
 * - Sikrer at der findes en række med `id = auth.uid` (fx hvis trigger fejlede eller gamle konti).
 * - Opdaterer `email` når auth-e-mail er ændret.
 * - Rører ikke `role` på eksisterende rækker. Ny række fra klient får `role: 'user'`.
 */
export async function ensureProfileSyncedWithAuth(
  supabase: SupabaseClient,
  user: AuthUserSync,
  options?: EnsureProfileOptions
): Promise<{ ok: true } | { ok: false; message: string }> {
  void options
  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('id,role,email')
    .eq('id', user.id)
    .maybeSingle()

  if (selectError) {
    return { ok: false, message: selectError.message }
  }

  if (!existing) {
    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email ?? null,
      role: 'user',
    })
    if (insertError) {
      const { data: again } = await supabase
        .from('profiles')
        .select('id,role,email')
        .eq('id', user.id)
        .maybeSingle()
      if (!again) {
        return { ok: false, message: insertError.message }
      }
      return applyProfilePatches(supabase, user, again)
    }
    return { ok: true }
  }

  return applyProfilePatches(supabase, user, existing)
}

async function applyProfilePatches(
  supabase: SupabaseClient,
  user: AuthUserSync,
  existing: { id: string; role: string; email: string | null }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const updates: Record<string, unknown> = {}

  const authEmail = user.email ?? null
  if (authEmail !== (existing.email ?? null)) {
    updates.email = authEmail
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true }
  }

  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
  if (error) {
    return { ok: false, message: error.message }
  }
  return { ok: true }
}
