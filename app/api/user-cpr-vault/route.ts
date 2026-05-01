import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Gemmer/overskriver CPR i user_cpr_vault med brugerens JWT fra Authorization-header.
 * Bruges fra onboarding så RLS får auth.uid() korrekt (undgår klient-session/PostgREST-afvigelser efter production build).
 */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Mangler Supabase-konfiguration.' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!jwt) {
    return NextResponse.json({ error: 'Mangler Authorization Bearer token.' }, { status: 401 })
  }

  let body: { cpr_ciphertext?: string; cpr_hash?: string }
  try {
    body = (await request.json()) as { cpr_ciphertext?: string; cpr_hash?: string }
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON.' }, { status: 400 })
  }

  const cpr_ciphertext = typeof body.cpr_ciphertext === 'string' ? body.cpr_ciphertext.trim() : ''
  const cpr_hash = typeof body.cpr_hash === 'string' ? body.cpr_hash.trim() : ''
  if (!cpr_ciphertext || !cpr_hash) {
    return NextResponse.json({ error: 'Mangler cpr_ciphertext eller cpr_hash.' }, { status: 400 })
  }

  const supabase = createClient(url, key, {
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(jwt)
  if (userError || !user) {
    return NextResponse.json(
      { error: userError?.message ?? 'Ugyldig eller udløbet session.' },
      { status: 401 }
    )
  }

  const { error: upsertError } = await supabase.from('user_cpr_vault').upsert(
    {
      user_id: user.id,
      cpr_ciphertext,
      cpr_hash,
    },
    { onConflict: 'user_id' }
  )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
