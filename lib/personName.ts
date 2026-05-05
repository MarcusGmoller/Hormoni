/** Sammensæt til ét `full_name` / `professional_name` (ét mellemrum). */
export function combineFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim()
}

/** Opdel eksisterende fuldt navn til fornavn + efternavn (første ord vs resten). */
export function splitFullName(fullName: string | null | undefined): {
  firstName: string
  lastName: string
} {
  const t = (fullName ?? '').trim()
  if (!t) return { firstName: '', lastName: '' }
  const parts = t.split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}
