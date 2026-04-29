'use client'

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './doctorLayout.module.css'

type View = 'patients' | 'messages' | 'calendar' | 'reporting' | 'stats' | 'settings'

const nav = [
  { view: 'patients' as const, label: 'Patienter', icon: '👤' },
  { view: 'messages' as const, label: 'Beskeder', icon: '💬' },
  { view: 'calendar' as const, label: 'Kalender', icon: '🗓️' },
  { view: 'reporting' as const, label: 'Indberet tid', icon: '⏱️' },
  { view: 'stats' as const, label: 'Statistik', icon: '📊' },
  { view: 'settings' as const, label: 'Indstillinger', icon: '⚙️' },
]

export default function DoctorLayoutClient({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [doctorName, setDoctorName] = useState('Gynækolog')
  const [doctorRole, setDoctorRole] = useState('Professional')
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const [pendingAppointmentsCount, setPendingAppointmentsCount] = useState(0)
  const activeParam = searchParams.get('view')
  const activeFromUrl: View =
    activeParam === 'patients' ||
    activeParam === 'messages' ||
    activeParam === 'calendar' ||
    activeParam === 'reporting' ||
    activeParam === 'stats' ||
    activeParam === 'settings'
      ? activeParam
      : 'patients'

  const refreshBadges = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUnreadMessagesCount(0)
      setPendingAppointmentsCount(0)
      return
    }

    if (activeFromUrl === 'messages') {
      localStorage.setItem(`doctor_messages_seen_at_${user.id}`, new Date().toISOString())
      setUnreadMessagesCount(0)
    } else {
      const { data: conversationRows } = await supabase
        .from('conversations')
        .select('id')
        .eq('doctor_id', user.id)

      const conversationIds = (conversationRows ?? []).map((row: { id: string }) => row.id)
      if (conversationIds.length === 0) {
        setUnreadMessagesCount(0)
      } else {
        const seenAt =
          localStorage.getItem(`doctor_messages_seen_at_${user.id}`) ?? '1970-01-01T00:00:00.000Z'
        const { data: unreadRows } = await supabase
          .from('messages')
          .select('id')
          .in('conversation_id', conversationIds)
          .neq('sender_id', user.id)
          .gt('created_at', seenAt)
        setUnreadMessagesCount((unreadRows ?? []).length)
      }
    }

    const { data: pendingRows } = await supabase
      .from('appointments')
      .select('id,user_id')
      .eq('professional_id', user.id)
      .eq('status', 'requested')
      .gte('start_time', new Date().toISOString())
    const pending = (pendingRows ?? []) as Array<{ id: string; user_id: string }>
    const patientIds = Array.from(new Set(pending.map((row) => row.user_id).filter(Boolean)))
    if (patientIds.length === 0) {
      setPendingAppointmentsCount(0)
      return
    }
    const { data: patientRows } = await supabase
      .from('profiles')
      .select('id,role')
      .in('id', patientIds)
      .eq('role', 'user')
    const validPatientIds = new Set((patientRows ?? []).map((row: { id: string }) => row.id))
    const validCount = pending.filter((row) => validPatientIds.has(row.user_id)).length
    setPendingAppointmentsCount(validCount)
  }, [activeFromUrl])

  useEffect(() => {
    const loadDoctorMeta = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileRows } = await supabase
        .from('profiles')
        .select('full_name,role')
        .eq('id', user.id)
        .limit(1)
      const profile = profileRows?.[0]

      if (profile?.full_name) setDoctorName(profile.full_name)
      if (profile?.role === 'professional') {
        setDoctorRole('Gynækolog')
      } else if (profile?.role) {
        setDoctorRole(profile.role)
      }
    }

    loadDoctorMeta()
  }, [])

  useEffect(() => {
    refreshBadges()
    const interval = window.setInterval(refreshBadges, 15000)
    const onFocus = () => refreshBadges()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshBadges])

  const doctorInitials = useMemo(() => {
    return doctorName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'DR'
  }, [doctorName])

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>〰️</div>
          <div>
            <div className={styles.brandTitle}>Hormon(i)</div>
            <div className={styles.brandSubtitle}>Professional Portal</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {nav.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`${styles.navItem} ${activeFromUrl === item.view ? styles.navItemActive : ''}`}
              onClick={() => {
                router.push(`${pathname}?view=${item.view}`)
              }}
            >
              <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {item.view === 'messages' && unreadMessagesCount > 0 && (
                <span className={styles.navBadge}>{unreadMessagesCount}</span>
              )}
              {item.view === 'patients' && pendingAppointmentsCount > 0 && (
                <span className={styles.navBadge}>{pendingAppointmentsCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.userChipButton}
            onClick={() => router.push(`${pathname}?view=settings`)}
          >
            <div className={styles.userChip}>
              <div className={styles.userAvatar}>{doctorInitials}</div>
              <div className={styles.userMeta}>
                <div className={styles.userName}>{doctorName}</div>
                <div className={styles.userRole}>{doctorRole}</div>
              </div>
            </div>
          </button>

          <button type="button" className={styles.logoutBtn}>
            Log ud
          </button>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  )
}
