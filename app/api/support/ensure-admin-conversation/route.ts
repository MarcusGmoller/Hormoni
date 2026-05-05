import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceEnvOrError } from '@/lib/requireSupabaseServiceEnv'

const conversationSelect =
  'id,patient_id,doctor_id,created_at,kind,created_from_appointment_id' as const

const welcomeBody =
  'Hej fra Hormoni. Her kan du skrive til administrationen, hvis du oplever problemer med platformen, din konto eller har andre praktiske spørgsmål. Vi bestræber os på at svare hurtigst muligt på hverdage.'

/**
 * Sikrer én admin-support-tråd (kind = admin) for den loggede bruger.
 * Primært backup hvis ingen admin fandtes ved profil-oprettelse.
 */
export async function POST(request: NextRequest) {
  const boot = getSupabaseServiceEnvOrError()
  if (!boot.ok) return boot.response

  const { url, publishableKey, serviceRoleKey } = boot.env

  const authHeader = request.headers.get('authorization')
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!jwt) {
    return NextResponse.json({ error: 'Mangler Authorization Bearer token.' }, { status: 401 })
  }

  const authClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(jwt)

  if (userError || !user) {
    return NextResponse.json({ error: userError?.message ?? 'Ugyldig session.' }, { status: 401 })
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role === 'admin') {
    return NextResponse.json({ error: 'Administratorer har ikke en support-tråd til sig selv.' }, { status: 400 })
  }

  const { data: admins, error: adminErr } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)

  if (adminErr || !admins?.length) {
    return NextResponse.json(
      { error: 'Ingen administrator fundet. Opret mindst én profil med role = admin.' },
      { status: 503 }
    )
  }

  const adminId = admins[0].id as string

  /** Én logisk tråd: patient + platform-admin. `kind` kan have været 'clinical' efter ALTER DEFAULT. */
  const { data: pairRows, error: findErr } = await adminClient
    .from('conversations')
    .select(conversationSelect)
    .eq('patient_id', user.id)
    .eq('doctor_id', adminId)

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 400 })
  }

  const rows = pairRows ?? []
  const existingAdminKind = rows.find((r) => r.kind === 'admin')
  const existingAny = existingAdminKind ?? rows[0]

  if (existingAny?.id) {
    let resolved = existingAny
    if (existingAny.kind !== 'admin') {
      const { data: updated, error: upErr } = await adminClient
        .from('conversations')
        .update({ kind: 'admin' })
        .eq('id', existingAny.id)
        .select(conversationSelect)
        .single()

      if (upErr || !updated?.id) {
        return NextResponse.json({ error: upErr?.message ?? 'Kunne ikke rette samtale-type.' }, { status: 400 })
      }
      resolved = updated
    }

    const { count } = await adminClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', resolved.id)

    if (!count) {
      await adminClient.from('messages').insert({
        conversation_id: resolved.id,
        sender_id: adminId,
        body: welcomeBody,
        recipient_id: user.id,
      })
    }

    return NextResponse.json({ conversationId: resolved.id, conversation: resolved })
  }

  const { data: inserted, error: insertErr } = await adminClient
    .from('conversations')
    .insert({
      patient_id: user.id,
      doctor_id: adminId,
      kind: 'admin',
      created_from_appointment_id: null,
    })
    .select(conversationSelect)
    .single()

  if (insertErr || !inserted?.id) {
    return NextResponse.json({ error: insertErr?.message ?? 'Kunne ikke oprette samtale.' }, { status: 400 })
  }

  const { count } = await adminClient
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', inserted.id)

  if (!count) {
    await adminClient.from('messages').insert({
      conversation_id: inserted.id,
      sender_id: adminId,
      body: welcomeBody,
      recipient_id: user.id,
    })
  }

  return NextResponse.json({ conversationId: inserted.id, conversation: inserted })
}
