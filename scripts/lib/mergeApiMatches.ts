import { normalizeTeam } from './teamMatch'
import type { ApiMatch } from './worldcup26Api'

const FINAL_API_STATUSES = new Set(['FINISHED', 'AWARDED'])
const LIVE_API_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'])

const LIVE_STATUS_PRIORITY: Record<string, number> = {
  IN_PLAY: 20,
  PAUSED: 20,
  LIVE: 20,
  EXTRA_TIME: 20,
  PENALTY_SHOOTOUT: 20,
  TIMED: 5,
  SCHEDULED: 5,
}

export function isFinalApiStatus(status: string): boolean {
  return FINAL_API_STATUSES.has(status)
}

export function isLiveApiStatus(status: string): boolean {
  return LIVE_API_STATUSES.has(status)
}

export function extractApiScore(match: ApiMatch): { home: number; away: number } | null {
  const blocks = [match.score.fullTime, match.score.regularTime, match.score.halfTime]
  for (const block of blocks) {
    if (
      block?.home !== null &&
      block?.home !== undefined &&
      block?.away !== null &&
      block?.away !== undefined
    ) {
      return { home: block.home, away: block.away }
    }
  }
  return null
}

/**
 * Placar do tempo normal (90min): prefere `regularTime`, cai pra `fullTime` (jogos de
 * grupo só trazem fullTime, que já é o 90min) e por fim `halfTime`.
 */
export function extractRegularScore(match: ApiMatch): { home: number; away: number } | null {
  const blocks = [match.score.regularTime, match.score.fullTime, match.score.halfTime]
  for (const block of blocks) {
    if (
      block?.home !== null &&
      block?.home !== undefined &&
      block?.away !== null &&
      block?.away !== undefined
    ) {
      return { home: block.home, away: block.away }
    }
  }
  return null
}

export function extractPenalties(match: ApiMatch): { home: number; away: number } | null {
  const pen = match.score.penalties
  if (pen?.home !== null && pen?.home !== undefined && pen?.away !== null && pen?.away !== undefined) {
    return { home: pen.home, away: pen.away }
  }
  return null
}

/** Quem avançou no confronto: usa `winner` da API, depois pênaltis, depois o placar decisivo. */
export function extractVencedor(match: ApiMatch): 'casa' | 'fora' | null {
  const winner = match.score.winner
  if (winner === 'HOME_TEAM') return 'casa'
  if (winner === 'AWAY_TEAM') return 'fora'

  const pen = extractPenalties(match)
  if (pen && pen.home !== pen.away) return pen.home > pen.away ? 'casa' : 'fora'

  if (winner === 'DRAW') return null

  const full = match.score.fullTime
  if (
    full?.home !== null &&
    full?.home !== undefined &&
    full?.away !== null &&
    full?.away !== undefined &&
    full.home !== full.away
  ) {
    return full.home > full.away ? 'casa' : 'fora'
  }
  return null
}

function liveMatchQuality(match: ApiMatch): number {
  const base = LIVE_STATUS_PRIORITY[match.status] ?? 0
  const score = extractApiScore(match)
  if (!score) return base
  if (score.home > 0 || score.away > 0) return base + 10
  return base + 3
}

function apiMatchKey(match: ApiMatch): string {
  const names = [normalizeTeam(match.homeTeam.name), normalizeTeam(match.awayTeam.name)].sort()
  return names.join('|')
}

function isValidApiMatch(match: ApiMatch): boolean {
  return Boolean(match.homeTeam?.name && match.awayTeam?.name)
}

/** Completa winner/pênaltis do `primary` a partir do `fallback` quando faltarem. */
function withFallbackWinner(primary: ApiMatch, fallback: ApiMatch): ApiMatch {
  const needsWinner = primary.score.winner === null || primary.score.winner === undefined
  const needsPenalties = !extractPenalties(primary)
  if (!needsWinner && !needsPenalties) return primary

  const score = { ...primary.score }
  if (needsWinner && fallback.score.winner !== null && fallback.score.winner !== undefined) {
    score.winner = fallback.score.winner
  }
  if (needsPenalties) {
    const pen = extractPenalties(fallback)
    if (pen) score.penalties = { home: pen.home, away: pen.away }
  }
  return { ...primary, score }
}

/** Mescla placar de `fallback` quando `primary` é final mas sem score na API. */
function withFallbackScore(primary: ApiMatch, fallback: ApiMatch): ApiMatch {
  const withWinner = withFallbackWinner(primary, fallback)
  if (extractApiScore(withWinner)) return withWinner
  const fallbackScore = extractApiScore(fallback)
  if (!fallbackScore) return withWinner
  return {
    ...withWinner,
    score: {
      ...withWinner.score,
      fullTime: { home: fallbackScore.home, away: fallbackScore.away },
    },
  }
}

/**
 * Entre duas fontes para o mesmo jogo, status finalizado (FINISHED/AWARDED) sempre vence.
 */
export function mergeApiMatchPair(a: ApiMatch, b: ApiMatch): ApiMatch {
  const aFinal = isFinalApiStatus(a.status)
  const bFinal = isFinalApiStatus(b.status)

  if (aFinal && !bFinal) return withFallbackScore(a, b)
  if (bFinal && !aFinal) return withFallbackScore(b, a)

  if (aFinal && bFinal) {
    const scoreA = extractApiScore(a)
    const scoreB = extractApiScore(b)
    if (scoreA && !scoreB) return withFallbackWinner(a, b)
    if (scoreB && !scoreA) return withFallbackWinner(b, a)
    return liveMatchQuality(a) >= liveMatchQuality(b)
      ? withFallbackWinner(a, b)
      : withFallbackWinner(b, a)
  }

  return liveMatchQuality(a) >= liveMatchQuality(b)
    ? withFallbackWinner(a, b)
    : withFallbackWinner(b, a)
}

export function mergeApiMatches(...groups: ApiMatch[][]): ApiMatch[] {
  const map = new Map<string, ApiMatch>()
  for (const group of groups) {
    for (const match of group) {
      if (!isValidApiMatch(match)) continue
      const key = apiMatchKey(match)
      const existing = map.get(key)
      map.set(key, existing ? mergeApiMatchPair(existing, match) : match)
    }
  }
  return [...map.values()]
}
