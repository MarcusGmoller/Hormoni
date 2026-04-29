'use client'

import { ReactNode } from 'react'
import styles from './patientPortalShell.module.css'

export default function PatientPortalShell({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>
}
