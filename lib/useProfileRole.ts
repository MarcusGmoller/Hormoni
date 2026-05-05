'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSupabaseUser } from '@/lib/useSupabaseUser'

/** `profiles.role` fra databasen; `null` når ingen session eller ingen række. */
export function useProfileRole(): { loading: boolean; role: string | null } {
  const user = useSupabaseUser()
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRole(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setRole(null)
        else setRole((data?.role as string | undefined) ?? null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  return { loading, role }
}

export function isAdminProfileRole(role: string | null | undefined): boolean {
  return role === 'admin'
}
