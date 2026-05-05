import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type DeleteRequestBody = {
  confirmText?: string
}

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

  let body: DeleteRequestBody
  try {
    body = (await request.json()) as DeleteRequestBody
  } catch {
    return NextResponse.json({ error: 'Ugyldig JSON.' }, { status: 400 })
  }

  if ((body.confirmText ?? '').trim().toUpperCase() !== 'SLET MIN PROFIL') {
    return NextResponse.json(
      { error: 'Bekræftelse mangler. Skriv "SLET MIN PROFIL" for at fortsætte.' },
      { status: 400 }
    )
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
    return NextResponse.json(
      { error: userError?.message ?? 'Ugyldig eller udløbet session.' },
      { status: 401 }
    )
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const anonSubjectId = randomUUID()

  const [{ data: healthLogs, error: healthLogsError }, { data: appointments, error: appointmentsError }, { data: prescriptions, error: prescriptionsError }] =
    await Promise.all([
      adminClient
        .from('user_health_condition_logs')
        .select('created_at,symptom_scores,health_conditions,notes')
        .eq('user_id', user.id),
      adminClient
        .from('appointments')
        .select('start_time,end_time,status,professional_id')
        .eq('user_id', user.id),
      adminClient
        .from('prescriptions')
        .select('issued_at,medication_name,dosage,instructions,doctor_id')
        .eq('patient_id', user.id),
    ])

  if (healthLogsError || appointmentsError || prescriptionsError) {
    return NextResponse.json(
      {
        error:
          healthLogsError?.message ??
          appointmentsError?.message ??
          prescriptionsError?.message ??
          'Kunne ikke hente data til anonymisering.',
      },
      { status: 400 }
    )
  }

  const healthRows = (healthLogs ?? []).map((row: any) => ({
    anon_subject_id: anonSubjectId,
    created_at: row.created_at,
    symptom_scores: row.symptom_scores ?? {},
    health_conditions: row.health_conditions ?? [],
    notes: row.notes ?? null,
  }))

  const treatmentRows = [
    ...((appointments ?? []).map((row: any) => ({
      anon_subject_id: anonSubjectId,
      record_type: 'appointment',
      treatment_at: row.start_time,
      payload: {
        status: row.status,
        professional_id: row.professional_id,
        duration_minutes:
          row.end_time && row.start_time
            ? Math.max(
                0,
                Math.round(
                  (new Date(row.end_time).getTime() - new Date(row.start_time).getTime()) / (1000 * 60)
                )
              )
            : null,
      },
    })) ?? []),
    ...((prescriptions ?? []).map((row: any) => ({
      anon_subject_id: anonSubjectId,
      record_type: 'prescription',
      treatment_at: row.issued_at,
      payload: {
        medication_name: row.medication_name,
        dosage: row.dosage ?? null,
        instructions: row.instructions ?? null,
        doctor_id: row.doctor_id,
      },
    })) ?? []),
  ]

  if (healthRows.length > 0) {
    const { error: insertHealthError } = await adminClient.from('anonymized_health_logs').insert(healthRows)
    if (insertHealthError) {
      return NextResponse.json({ error: insertHealthError.message }, { status: 400 })
    }
  }

  if (treatmentRows.length > 0) {
    const { error: insertTreatmentError } = await adminClient
      .from('anonymized_treatment_history')
      .insert(treatmentRows as any[])
    if (insertTreatmentError) {
      return NextResponse.json({ error: insertTreatmentError.message }, { status: 400 })
    }
  }

  const { data: patientConversations, error: conversationsLoadError } = await adminClient
    .from('conversations')
    .select('id')
    .eq('patient_id', user.id)
  if (conversationsLoadError) {
    return NextResponse.json({ error: conversationsLoadError.message }, { status: 400 })
  }
  const patientConversationIds = (patientConversations ?? []).map((row: any) => row.id)

  if (patientConversationIds.length > 0) {
    const { error: deleteConversationMessagesError } = await adminClient
      .from('messages')
      .delete()
      .in('conversation_id', patientConversationIds)
    if (deleteConversationMessagesError) {
      return NextResponse.json({ error: deleteConversationMessagesError.message }, { status: 400 })
    }
  }

  const deleteSteps: Array<() => Promise<{ error: { message: string } | null }>> = [
    () => adminClient.from('messages').delete().eq('sender_id', user.id),
    () => adminClient.from('clinical_notes').delete().eq('patient_id', user.id),
    () => adminClient.from('prescriptions').delete().eq('patient_id', user.id),
    () => adminClient.from('encounters').delete().eq('patient_id', user.id),
    () => adminClient.from('patient_health_audit').delete().eq('patient_id', user.id),
    () => adminClient.from('sensitive_access_log').delete().eq('patient_id', user.id),
    () => adminClient.from('professional_activity').delete().eq('patient_id', user.id),
    () => adminClient.from('conversations').delete().eq('patient_id', user.id),
    () => adminClient.from('appointments').delete().eq('user_id', user.id),
    () => adminClient.from('user_health_condition_logs').delete().eq('user_id', user.id),
    () => adminClient.from('user_cpr_vault').delete().eq('user_id', user.id),
    () => adminClient.from('subscriptions').delete().eq('user_id', user.id),
    () => adminClient.from('profiles').delete().eq('id', user.id),
  ]

  for (const run of deleteSteps) {
    const { error } = await run()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  const { error: deleteAuthUserError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteAuthUserError) {
    return NextResponse.json({ error: deleteAuthUserError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
