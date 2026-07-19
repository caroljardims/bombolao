import { fromZonedTime } from 'date-fns-tz'
import type { Partida } from '../../src/lib/types'
import { isPlaceholderTeam } from './footballData'
import { teamsMatch } from './teamMatch'

const TIMEZONE = 'America/Sao_Paulo'
const KICKOFF_TOLERANCE_MS = 3 * 60 * 60 * 1000

/** Campos usados no matching (football-data tem `id`; WorldCup26 não). */
export type MatchableApiMatch = {
  id?: number
  utcDate: string
  homeTeam: { name?: string | null; shortName?: string; tla?: string }
  awayTeam: { name?: string | null; shortName?: string; tla?: string }
}

export function getKickoffDate(partida: Partida): Date {
  return fromZonedTime(`${partida.data}T${partida.hora}:00`, TIMEZONE)
}

function parsePartidaDate(utcDate: string): string {
  return utcDate.slice(0, 10)
}

/** Id de mata-mata importado: `{data}-{stage}-{apiMatchId}`. */
export function findPartidaByApiMatchId(
  partidas: Partida[],
  apiMatchId: number,
): Partida | undefined {
  const suffix = `-${apiMatchId}`
  return partidas.find((p) => p.id.endsWith(suffix))
}

export function samePartida(a: Partida, b: Partida): boolean {
  // Dois "A definir" no mesmo dia (final × 3º) não são o mesmo jogo.
  if (
    isPlaceholderTeam(a.time_casa) ||
    isPlaceholderTeam(a.time_fora) ||
    isPlaceholderTeam(b.time_casa) ||
    isPlaceholderTeam(b.time_fora)
  ) {
    return a.id === b.id
  }
  if (
    !teamsMatch(a.time_casa, { name: b.time_casa }) ||
    !teamsMatch(a.time_fora, { name: b.time_fora })
  ) {
    return false
  }
  return Math.abs(getKickoffDate(a).getTime() - getKickoffDate(b).getTime()) <= KICKOFF_TOLERANCE_MS
}

/** Casa partida do bolão com jogo da API (id da API, data UTC ou kickoff ±3h). */
export function findMatchingPartida(
  partidas: Partida[],
  apiMatch: MatchableApiMatch,
): Partida | undefined {
  if (typeof apiMatch.id === 'number') {
    const byApiId = findPartidaByApiMatchId(partidas, apiMatch.id)
    if (byApiId) return byApiId
  }

  const apiDate = parsePartidaDate(apiMatch.utcDate)
  const apiKickoff = new Date(apiMatch.utcDate).getTime()
  const home = { name: apiMatch.homeTeam.name ?? '', shortName: apiMatch.homeTeam.shortName, tla: apiMatch.homeTeam.tla }
  const away = { name: apiMatch.awayTeam.name ?? '', shortName: apiMatch.awayTeam.shortName, tla: apiMatch.awayTeam.tla }

  const byDate = partidas.find(
    (p) =>
      p.data === apiDate &&
      teamsMatch(p.time_casa, home) &&
      teamsMatch(p.time_fora, away),
  )
  if (byDate) return byDate

  return partidas.find((p) => {
    if (!teamsMatch(p.time_casa, home) || !teamsMatch(p.time_fora, away)) {
      return false
    }
    if (!Number.isFinite(apiKickoff)) return false
    const kickoff = getKickoffDate(p).getTime()
    return Math.abs(kickoff - apiKickoff) <= KICKOFF_TOLERANCE_MS
  })
}

/** Prefere id de template do bracket (`r32-*`) para bolões mata-mata. */
export function pickCanonicalPartida(a: Partida, b: Partida): Partida {
  const aR32 = a.id.startsWith('r32-')
  const bR32 = b.id.startsWith('r32-')
  if (aR32 && !bR32) return a
  if (bR32 && !aR32) return b
  return a.id.length <= b.id.length ? a : b
}

function mergePartidaFields(canonical: Partida, others: Partida[]): Partida {
  const merged = { ...canonical }
  for (const p of others) {
    if (p.id === canonical.id) continue
    if (merged.gols_casa == null && p.gols_casa != null) {
      merged.gols_casa = p.gols_casa
      merged.gols_fora = p.gols_fora
    }
    if (!merged.status_api && p.status_api) merged.status_api = p.status_api
    if (merged.vencedor == null && p.vencedor != null) merged.vencedor = p.vencedor
    if (merged.penaltis_casa == null && p.penaltis_casa != null) {
      merged.penaltis_casa = p.penaltis_casa
      merged.penaltis_fora = p.penaltis_fora
    }
  }
  return merged
}

/** Remove partidas duplicadas (mesmos times + kickoff próximo). */
export function dedupePartidas(partidas: Partida[]): Partida[] {
  const remaining = [...partidas]
  const result: Partida[] = []

  while (remaining.length > 0) {
    const current = remaining.shift()!
    const group = [current]
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (samePartida(current, remaining[i])) {
        group.push(remaining[i])
        remaining.splice(i, 1)
      }
    }
    let canonical = group[0]
    for (let i = 1; i < group.length; i++) {
      canonical = pickCanonicalPartida(canonical, group[i])
    }
    result.push(mergePartidaFields(canonical, group))
  }

  return result.sort((a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime())
}
