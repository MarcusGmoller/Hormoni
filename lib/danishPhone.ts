/** Normaliser til cifre (nationalt); understøtter +45 og 0045. */
export function normalizeDanishPhone(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, '')
  let rest = trimmed
  if (rest.startsWith('+45')) rest = rest.slice(3)
  else if (rest.toLowerCase().startsWith('0045')) rest = rest.slice(4)
  return rest.replace(/\D/g, '')
}

/** Typisk dansk mobil/fastnet: præcis 8 cifre efter normalisering. */
export function isDanishPhone8Digits(value: string): boolean {
  return /^\d{8}$/.test(normalizeDanishPhone(value))
}
