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

function scoreBlock(
  block: { home: number | null; away: number | null } | undefined,
): { home: number; away: number } | null {
  if (
    block?.home !== null &&
    block?.home !== undefined &&
    block?.away !== null &&
    block?.away !== undefined
  ) {
    return { home: block.home, away: block.away }
  }
  return null
}

/**
 * Quando a football-data marca prorrogação mas deixa `regularTime` nulo, o placar
 * dos 90 min é `fullTime − extraTime` (ex.: final 1×0 na PR com extraTime 1×0 → 0×0).
 */
function deriveRegularFromExtraTime(match: ApiMatch): { home: number; away: number } | null {
  const full = scoreBlock(match.score.fullTime)
  const et = scoreBlock(match.score.extraTime)
  if (!full || !et) return null
  const home = full.home - et.home
  const away = full.away - et.away
  if (home < 0 || away < 0) return null
  return { home, away }
}

/** True se o jogo foi (ou está) além dos 90 min — inclusive quando a API erra o `duration`. */
export function isBeyondRegularTime(match: ApiMatch): boolean {
  if (match.score.duration === 'EXTRA_TIME' || match.score.duration === 'PENALTY_SHOOTOUT') {
    return true
  }
  // football-data às vezes devolve duration=REGULAR com extraTime preenchido (ex.: final 2026).
  return scoreBlock(match.score.extraTime) !== null
}

/**
 * Placar do tempo normal (90min): prefere `regularTime`. Se a API só trouxer
 * `extraTime` + `fullTime`, deriva os 90 min. Só usa `fullTime` direto quando o
 * jogo não foi para prorrogação/pênaltis (aí fullTime inclui gols extras).
 */
export function extractRegularScore(match: ApiMatch): { home: number; away: number } | null {
  const rt = scoreBlock(match.score.regularTime)
  if (rt) return rt

  // Mesmo com duration=REGULAR, se há bloco extraTime o fullTime inclui a PR.
  const derived = deriveRegularFromExtraTime(match)
  if (derived) return derived

  if (isBeyondRegularTime(match)) return null

  return scoreBlock(match.score.fullTime) ?? scoreBlock(match.score.halfTime)
}

/** True quando a API traz o bloco `regularTime` (placar oficial dos 90 min). */
export function hasRegularTimeScore(match: ApiMatch): boolean {
  return scoreBlock(match.score.regularTime) !== null
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

/** Completa winner/pênaltis/regularTime/extraTime do `fallback` quando faltarem no `primary`. */
function enrichFromFallback(primary: ApiMatch, fallback: ApiMatch): ApiMatch {
  const score = { ...primary.score }

  if (score.winner === null || score.winner === undefined) {
    if (fallback.score.winner !== null && fallback.score.winner !== undefined) {
      score.winner = fallback.score.winner
    }
  }

  if (!extractPenalties({ ...primary, score })) {
    const pen = extractPenalties(fallback)
    if (pen) score.penalties = { home: pen.home, away: pen.away }
  }

  if (!hasRegularTimeScore({ ...primary, score }) && hasRegularTimeScore(fallback)) {
    score.regularTime = fallback.score.regularTime
  }

  if (!scoreBlock(score.extraTime) && scoreBlock(fallback.score.extraTime)) {
    score.extraTime = fallback.score.extraTime
  }

  score.duration = mergeDuration(score.duration, fallback.score.duration)

  return { ...primary, score }
}

/** Mescla placar de `fallback` quando `primary` é final mas sem score na API. */
function withFallbackScore(primary: ApiMatch, fallback: ApiMatch): ApiMatch {
  const enriched = enrichFromFallback(primary, fallback)
  if (extractApiScore(enriched)) return enriched
  const fallbackScore = extractApiScore(fallback)
  if (!fallbackScore) return enriched
  return {
    ...enriched,
    score: {
      ...enriched.score,
      fullTime: { home: fallbackScore.home, away: fallbackScore.away },
    },
  }
}

/**
 * Data/hora UTC mais confiável entre as fontes. A football-data.org devolve UTC
 * real (ISO terminando em `Z`); a WorldCup26 devolve horário do estádio (naive),
 * que para jogos de madrugada (BRT) cai em outro dia e quebra o matching. Por isso
 * preferimos sempre a data terminada em `Z` quando existir.
 */
function reliableUtcDate(a: ApiMatch, b: ApiMatch, fallback: string): string {
  if (a.utcDate?.endsWith('Z')) return a.utcDate
  if (b.utcDate?.endsWith('Z')) return b.utcDate
  return fallback
}

const DURATION_RANK: Record<string, number> = {
  REGULAR: 1,
  EXTRA_TIME: 2,
  PENALTY_SHOOTOUT: 3,
}

/**
 * Etapa mais avançada entre as fontes (REGULAR < EXTRA_TIME < PENALTY_SHOOTOUT).
 * Se a football-data marca prorrogação/pênaltis, isso prevalece sobre o WorldCup26
 * (que não informa etapa) — usado pelo sync para congelar o placar no tempo normal.
 */
function mergeDuration(a?: string, b?: string): string | undefined {
  const ra = a ? (DURATION_RANK[a] ?? 0) : 0
  const rb = b ? (DURATION_RANK[b] ?? 0) : 0
  if (ra === 0 && rb === 0) return a ?? b
  return ra >= rb ? a : b
}

/**
 * Entre duas fontes para o mesmo jogo, status finalizado (FINISHED/AWARDED) sempre vence.
 */
export function mergeApiMatchPair(a: ApiMatch, b: ApiMatch): ApiMatch {
  const aFinal = isFinalApiStatus(a.status)
  const bFinal = isFinalApiStatus(b.status)

  let result: ApiMatch
  if (aFinal && !bFinal) {
    result = withFallbackScore(a, b)
  } else if (bFinal && !aFinal) {
    result = withFallbackScore(b, a)
  } else if (aFinal && bFinal) {
    const scoreA = extractApiScore(a)
    const scoreB = extractApiScore(b)
    if (scoreA && !scoreB) result = enrichFromFallback(a, b)
    else if (scoreB && !scoreA) result = enrichFromFallback(b, a)
    else
      result =
        liveMatchQuality(a) >= liveMatchQuality(b)
          ? enrichFromFallback(a, b)
          : enrichFromFallback(b, a)
  } else {
    result =
      liveMatchQuality(a) >= liveMatchQuality(b)
        ? enrichFromFallback(a, b)
        : enrichFromFallback(b, a)
  }

  return {
    ...result,
    utcDate: reliableUtcDate(a, b, result.utcDate),
    score: { ...result.score, duration: mergeDuration(a.score.duration, b.score.duration) },
  }
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
