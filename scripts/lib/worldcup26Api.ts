/**
 * Cliente da API gratuita do World Cup 2026 (https://worldcup26.ir).
 * Docs: https://worldcup26.ir/api-docs
 */

/** Etapa do jogo conforme a football-data: tempo normal, prorrogação ou pênaltis. */
export type ApiDuration = 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'

export interface ApiMatch {
  utcDate: string
  status: string
  homeTeam: { name: string; shortName?: string; tla?: string }
  awayTeam: { name: string; shortName?: string; tla?: string }
  score: {
    winner?: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    /** Etapa alcançada; só a football-data informa. WorldCup26 deixa indefinido. */
    duration?: ApiDuration | string
    fullTime?: { home: number | null; away: number | null }
    regularTime?: { home: number | null; away: number | null }
    halfTime?: { home: number | null; away: number | null }
    /** Gols só na prorrogação (football-data). Usado para derivar o placar dos 90 min. */
    extraTime?: { home: number | null; away: number | null }
    penalties?: { home: number | null; away: number | null }
  }
  lastUpdated?: string
}

interface Wc26Game {
  home_team_name_en: string
  away_team_name_en: string
  home_score: string
  away_score: string
  local_date: string
  finished: string
  time_elapsed: string
}

const API_URL = 'https://worldcup26.ir/get/games'

function parseLocalDate(localDate: string): { isoDate: string; utcDate: string } {
  const [datePart, timePart = '12:00'] = localDate.trim().split(/\s+/)
  const [mm, dd, yyyy] = datePart.split('/')
  const isoDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  const hhmm = timePart.slice(0, 5)
  return { isoDate, utcDate: `${isoDate}T${hhmm}:00` }
}

function parseScorePair(home: string, away: string): { home: number; away: number } | null {
  const h = Number(home)
  const a = Number(away)
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null
  return { home: h, away: a }
}

function resolveStatus(game: Wc26Game): string {
  if (game.finished === 'TRUE' || game.time_elapsed === 'finished') return 'FINISHED'
  if (game.time_elapsed === 'notstarted') return 'TIMED'
  return 'IN_PLAY'
}

export function normalizeWc26Game(game: Wc26Game): ApiMatch | null {
  if (!game.home_team_name_en || !game.away_team_name_en) return null

  const { utcDate } = parseLocalDate(game.local_date)
  const status = resolveStatus(game)
  const fullTime = parseScorePair(game.home_score, game.away_score)

  return {
    utcDate,
    status,
    homeTeam: { name: game.home_team_name_en },
    awayTeam: { name: game.away_team_name_en },
    score: { fullTime: fullTime ?? { home: null, away: null } },
  }
}

export async function fetchWorldCup26Matches(): Promise<ApiMatch[]> {
  const res = await fetch(API_URL, {
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) {
    throw new Error(`WorldCup26 API retornou ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as { games?: Wc26Game[] }
  return (data.games ?? [])
    .map(normalizeWc26Game)
    .filter((m): m is ApiMatch => m !== null)
}
