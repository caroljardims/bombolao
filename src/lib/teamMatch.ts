export function normalizeTeam(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function teamsMatch(a: string, b: string): boolean {
  const na = normalizeTeam(a)
  const nb = normalizeTeam(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}
