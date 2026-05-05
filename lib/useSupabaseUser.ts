'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

/**
 * Bruger til nav m.m.: opdateres ved login/logud på tværs af faner via onAuthStateChange.
 */
export function useSupabaseUser(): User | null {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!cancelled) setUser(u)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return user
}
