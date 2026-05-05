import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !publishableKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Mangler Supabase miljøvariabler.' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!jwt) {
    return NextResponse.json({ error: 'Mangler Authorization Bearer token.' }, { status: 401 })
  }

  let body: { professionalUserId?: string }
  try {
    body = (await request.json()) as { professionalUserId?: string }
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON.' }, { status: 400 })
  }

  const professionalUserId =
    typeof body.professionalUserId === 'string' ? body.professionalUserId.trim() : ''
  if (!professionalUserId) {
    return NextResponse.json({ error: 'Mangler professionalUserId.' }, { status: 400 })
  }

  // Verificer at anmoder er logget ind.
  const authClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const {
    data: { user: requester },
    error: requesterError,
  } = await authClient.auth.getUser(jwt)

  if (requesterError || !requester) {
    return NextResponse.json(
      { error: requesterError?.message ?? 'Ugyldig eller udløbet session.' },
      { status: 401 }
    )
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: professionalRow, error: professionalLoadError } = await adminClient
    .from('professionals')
    .select('user_id,approval_status')
    .eq('user_id', professionalUserId)
    .maybeSingle()

  if (professionalLoadError) {
    return NextResponse.json({ error: professionalLoadError.message }, { status: 400 })
  }
  if (!professionalRow) {
    return NextResponse.json({ error: 'Professional ikke fundet.' }, { status: 404 })
  }
  if (professionalRow.approval_status !== 'pending') {
    return NextResponse.json(
      { error: 'Kun pending-profiler kan afvises og slettes.' },
      { status: 400 }
    )
  }

  // Slet afhængige data først, så vi ikke rammer FK-fejl.
  const { error: deleteProfessionalError } = await adminClient
    .from('professionals')
    .delete()
    .eq('user_id', professionalUserId)
  if (deleteProfessionalError) {
    return NextResponse.json({ error: deleteProfessionalError.message }, { status: 400 })
  }

  const { error: deleteVaultError } = await adminClient
    .from('user_cpr_vault')
    .delete()
    .eq('user_id', professionalUserId)
  if (deleteVaultError) {
    return NextResponse.json({ error: deleteVaultError.message }, { status: 400 })
  }

  const { error: deleteProfileError } = await adminClient
    .from('profiles')
    .delete()
    .eq('id', professionalUserId)
  if (deleteProfileError) {
    return NextResponse.json({ error: deleteProfileError.message }, { status: 400 })
  }

  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(professionalUserId)
  if (deleteAuthError) {
    return NextResponse.json({ error: deleteAuthError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
