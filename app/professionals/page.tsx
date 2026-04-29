'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './professionalsPage.module.css'

type Professional = {
  user_id: string
  title: string | null
  bio: string | null
  public_profile: boolean
  full_name: string | null
  profiles?: Array<{ full_name: string | null }> | { full_name: string | null } | null
}

export default function ProfessionalsPage() {
  const router = useRouter()
  const [items, setItems] = useState<Professional[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: professionals, error: loadError } = await supabase
        .from('professionals')
        .select('user_id,title,bio,public_profile,profiles!inner(full_name,role)')
        .eq('public_profile', true)
        .eq('profiles.role', 'professional')

      if (loadError) {
        setError(loadError.message)
        setLoading(false)
        return
      }

      const nextProfessionals = ((professionals as any[]) ?? []).map((item) => {
        const embeddedProfile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles

        return {
          ...item,
          full_name: embeddedProfile?.full_name ?? null,
        }
      }) as Professional[]

      const professionalIds = nextProfessionals.map((professional) => professional.user_id)
      if (professionalIds.length === 0) {
        setItems(nextProfessionals)
        setLoading(false)
        return
      }

      const idsMissingName = nextProfessionals
        .filter((professional) => !professional.full_name)
        .map((professional) => professional.user_id)

      if (idsMissingName.length === 0) {
        setItems(nextProfessionals)
        setLoading(false)
        return
      }

      const { data: profiles } = await supabase.from('profiles').select('id,full_name').in('id', idsMissingName)

      const namesById = (profiles ?? []).reduce<Record<string, string | null>>((acc, profile: any) => {
        acc[profile.id] = profile.full_name ?? null
        return acc
      }, {})

      setItems(
        nextProfessionals.map((professional) => ({
          ...professional,
          full_name: professional.full_name ?? namesById[professional.user_id] ?? null,
        }))
      )
      setLoading(false)
    }

    run()
  }, [])

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Book konsultation</h1>
          <p className={styles.lead}>Vælg en gynækolog og book et tidspunkt til video-konsultation.</p>
        </div>
      </header>

      <section className={styles.content}>
        {error && <div className={styles.errorBanner}>Fejl: {error}</div>}

        {loading ? (
          <p className={styles.loading}>Henter gynækologer…</p>
        ) : items.length === 0 && !error ? (
          <div className={styles.empty}>Ingen offentlige profiler at vise lige nu.</div>
        ) : (
          <div className={styles.list}>
            {items.map((p) => (
              <article key={p.user_id} className={styles.card}>
                <div className={styles.cardMain}>
                  <div className={styles.name}>{p.full_name ?? 'Ukendt navn'}</div>
                  {p.title ? <div className={styles.titleLine}>{p.title}</div> : null}
                  {p.bio ? (
                    <p className={styles.bio}>{p.bio}</p>
                  ) : (
                    <p className={styles.bio} style={{ color: '#94a3b8' }}>
                      Ingen bio angivet.
                    </p>
                  )}
                </div>
                <div className={styles.cardAside}>
                  <button type="button" className={styles.bookBtn} onClick={() => router.push(`/book/${p.user_id}`)}>
                    Book tid
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
