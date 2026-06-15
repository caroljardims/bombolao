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

/** Mescla placar de `fallback` quando `primary` é final mas sem score na API. */
function withFallbackScore(primary: ApiMatch, fallback: ApiMatch): ApiMatch {
  if (extractApiScore(primary)) return primary
  const fallbackScore = extractApiScore(fallback)
  if (!fallbackScore) return primary
  return {
    ...primary,
    score: {
      ...primary.score,
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
    if (scoreA && !scoreB) return a
    if (scoreB && !scoreA) return b
    return liveMatchQuality(a) >= liveMatchQuality(b) ? a : b
  }

  return liveMatchQuality(a) >= liveMatchQuality(b) ? a : b
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
