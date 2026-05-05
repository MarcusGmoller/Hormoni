'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type CheckResult = {
  name: string
  ok: boolean
  details: string
}

export default function DebugDbPage() {
  const [checks, setChecks] = useState<CheckResult[]>([])
  const [summary, setSummary] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      setChecks([])
      setSummary('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError(userError?.message ?? 'Ikke logget ind.')
        setLoading(false)
        return
      }

      const results: CheckResult[] = []

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id,full_name,role,subscription_tier')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      results.push({
        name: 'Profile findes',
        ok: Boolean(profile),
        details: profile ? `role=${profile.role}, subscription_tier=${profile.subscription_tier ?? 'NULL'}` : 'Mangler',
      })

      const validTier = profile?.subscription_tier === 'free' || profile?.subscription_tier === 'pro'
      results.push({
        name: 'Subscription tier er gyldig',
        ok: validTier,
        details: `Forventet free/pro, fik ${profile?.subscription_tier ?? 'NULL'}`,
      })

      const [{ data: cprVault, error: cprError }, { data: professionalRow, error: professionalError }] =
        await Promise.all([
          supabase.from('user_cpr_vault').select('user_id').eq('user_id', user.id).maybeSingle(),
          supabase.from('professionals').select('user_id').eq('user_id', user.id).maybeSingle(),
        ])

      if (cprError) {
        results.push({
          name: 'CPR vault relation',
          ok: false,
          details: `Fejl ved opslag: ${cprError.message}`,
        })
      } else {
        results.push({
          name: 'CPR vault relation',
          ok: Boolean(cprVault),
          details: cprVault ? 'user_cpr_vault række fundet' : 'Ingen række i user_cpr_vault',
        })
      }

      if (professionalError) {
        results.push({
          name: 'Professional relation',
          ok: false,
          details: `Fejl ved opslag: ${professionalError.message}`,
        })
      } else {
        const isProfessional = profile?.role === 'professional'
        const professionalOk = isProfessional ? Boolean(professionalRow) : !professionalRow
        results.push({
          name: 'Profile ↔ Professionals matcher',
          ok: professionalOk,
          details: isProfessional
            ? professionalRow
              ? 'Role professional og række i professionals findes'
              : 'Role professional men mangler række i professionals'
            : professionalRow
              ? 'Role user men har række i professionals'
              : 'Role user uden professionals-række (OK)',
        })
      }

      const [{ data: healthLogs, error: healthError }, { data: userPrescriptions, error: rxError }] =
        await Promise.all([
          supabase.from('user_health_condition_logs').select('id,user_id').eq('user_id', user.id).limit(200),
          supabase
            .from('prescriptions')
            .select('id,patient_id,doctor_id')
            .eq('patient_id', user.id)
            .limit(200),
        ])

      if (healthError) {
        results.push({
          name: 'Health logs relation',
          ok: false,
          details: `Fejl ved opslag: ${healthError.message}`,
        })
      } else {
        const mismatched = (healthLogs ?? []).filter((row: any) => row.user_id !== user.id).length
        results.push({
          name: 'Profile ↔ user_health_condition_logs matcher',
          ok: mismatched === 0,
          details: `${healthLogs?.length ?? 0} logs fundet, ${mismatched} mismatches`,
        })
      }

      if (rxError) {
        results.push({
          name: 'Prescription relation',
          ok: false,
          details: `Fejl ved opslag: ${rxError.message}`,
        })
      } else {
        const doctorIds = Array.from(
          new Set((userPrescriptions ?? []).map((row: any) => row.doctor_id).filter(Boolean))
        ) as string[]
        let validDoctorIds = new Set<string>()
        if (doctorIds.length > 0) {
          const { data: doctorProfiles } = await supabase
            .from('profiles')
            .select('id,role')
            .in('id', doctorIds)
          validDoctorIds = new Set(
            (doctorProfiles ?? [])
              .filter((row: any) => row.role === 'professional')
              .map((row: any) => row.id)
          )
        }
        const invalidPrescriptionCount = (userPrescriptions ?? []).filter(
          (row: any) => !validDoctorIds.has(row.doctor_id)
        ).length
        results.push({
          name: 'Prescriptions ↔ professionals matcher',
          ok: invalidPrescriptionCount === 0,
          details: `${userPrescriptions?.length ?? 0} recepter, ${invalidPrescriptionCount} med ugyldig doctor_id`,
        })
      }

      setChecks(results)
      const passed = results.filter((r) => r.ok).length
      const displayName = profile?.full_name?.trim() ? profile.full_name.trim() : user.email ?? user.id
      setSummary(`${passed}/${results.length} checks bestået for bruger ${displayName}`)
      setLoading(false)
    }

    run()
  }, [])

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">Debug DB</h1>
      <p className="text-sm text-gray-600 mb-4">
        Konsistenskontrol for: `user_health_condition_logs`, `profiles`, `professionals`, `prescriptions`,
        `user_cpr_vault`, `subscription_tier`.
      </p>

      {error && <div className="text-red-600 mb-4">Fejl: {error}</div>}
      {loading && <div className="text-gray-600 mb-4">Kører checks...</div>}
      {!loading && !error && <div className="text-sm font-medium mb-3">{summary}</div>}

      <div className="space-y-2">
        {checks.map((check) => (
          <div
            key={check.name}
            className={`rounded border p-3 text-sm ${
              check.ok ? 'border-green-200 bg-green-50 text-green-900' : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            <div className="font-semibold">{check.ok ? 'PASS' : 'FAIL'} · {check.name}</div>
            <div>{check.details}</div>
          </div>
        ))}
      </div>
    </main>
  )
}
