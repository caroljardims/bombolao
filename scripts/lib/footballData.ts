import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import displayNames from './teamDisplayNames.json'
import { teamsMatch } from './teamMatch'

const TIMEZONE = 'America/Sao_Paulo'

export interface ApiTeam {
  id?: number | null
  name?: string | null
  shortName?: string | null
  tla?: string | null
}

export interface ApiMatch {
  id: number
  utcDate: string
  status: string
  stage: string
  matchday?: number | null
  homeTeam: ApiTeam
  awayTeam: ApiTeam
  score: {
    winner?: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    fullTime?: { home: number | null; away: number | null }
    regularTime?: { home: number | null; away: number | null }
    halfTime?: { home: number | null; away: number | null }
    penalties?: { home: number | null; away: number | null }
  }
}

const STAGE_TO_FASE: Record<string, string> = {
  GROUP_STAGE: 'Primeira fase',
  LAST_32: '16 avos de final',
  LAST_16: 'Oitavas de final',
  QUARTER_FINALS: 'Quartas de final',
  SEMI_FINALS: 'Semifinal',
  THIRD_PLACE: 'Disputa de 3º lugar',
  FINAL: 'Final',
}

export function stageToFase(stage: string): string {
  return STAGE_TO_FASE[stage] ?? stage
}

export function utcToBrParts(utcDate: string): { data: string; hora: string } {
  const zoned = toZonedTime(new Date(utcDate), TIMEZONE)
  return {
    data: format(zoned, 'yyyy-MM-dd'),
    hora: format(zoned, 'HH:mm'),
  }
}

export function resolveTeamDisplay(apiTeam: ApiTeam): string | null {
  if (!apiTeam.name) return null

  for (const [key, display] of Object.entries(displayNames)) {
    if (teamsMatch(display, { name: apiTeam.name, shortName: apiTeam.shortName ?? undefined, tla: apiTeam.tla ?? undefined })) {
      return display
    }
    if (teamsMatch(key, { name: apiTeam.name, shortName: apiTeam.shortName ?? undefined, tla: apiTeam.tla ?? undefined })) {
      return display
    }
  }

  return apiTeam.name
}

export function teamTla(apiTeam: ApiTeam): string {
  if (apiTeam.tla) return apiTeam.tla.toUpperCase()
  if (apiTeam.shortName) return apiTeam.shortName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
  return 'TBD'
}

export function buildPartidaId(data: string, homeTeam: ApiTeam, awayTeam: ApiTeam): string {
  return `${data}-${teamTla(homeTeam)}-${teamTla(awayTeam)}`
}

export function knockoutPartidaId(match: ApiMatch, data: string): string {
  const stageSlug = match.stage.replace(/_/g, '-').toLowerCase()
  return `${data}-${stageSlug}-${match.id}`
}

export function extractScore(match: ApiMatch): { home: number; away: number } | null {
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

/** Label usado no Firestore enquanto o mata-mata ainda não tem finalistas. */
export const PLACEHOLDER_TEAM = 'A definir'

export function matchHasTeams(match: ApiMatch): boolean {
  return Boolean(match.homeTeam?.name && match.awayTeam?.name)
}

export function isPlaceholderTeam(name: string | null | undefined): boolean {
  if (!name) return true
  const n = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return n === 'adefinir' || n === 'tbd'
}

function isFinishedKnockout(match: ApiMatch): boolean {
  return match.status === 'FINISHED' || match.status === 'AWARDED'
}

function teamKey(team: ApiTeam | null | undefined): string | null {
  if (!team?.name) return null
  return team.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function winnerTeam(match: ApiMatch): ApiTeam | null {
  if (!isFinishedKnockout(match)) return null
  if (match.score?.winner === 'HOME_TEAM') return match.homeTeam
  if (match.score?.winner === 'AWAY_TEAM') return match.awayTeam
  return null
}

function loserTeam(match: ApiMatch): ApiTeam | null {
  if (!isFinishedKnockout(match)) return null
  if (match.score?.winner === 'HOME_TEAM') return match.awayTeam
  if (match.score?.winner === 'AWAY_TEAM') return match.homeTeam
  return null
}

function fillMissingSide(match: ApiMatch, candidates: ApiTeam[]): ApiMatch {
  const homeName = teamKey(match.homeTeam)
  const awayName = teamKey(match.awayTeam)
  const unused = candidates.filter((t) => {
    const k = teamKey(t)
    return k && k !== homeName && k !== awayName
  })

  let homeTeam = match.homeTeam
  let awayTeam = match.awayTeam
  let i = 0
  if (!homeName && unused[i]) homeTeam = unused[i++]
  if (!awayName && unused[i]) awayTeam = unused[i++]

  if (homeTeam === match.homeTeam && awayTeam === match.awayTeam) return match
  return { ...match, homeTeam, awayTeam }
}

/**
 * A football-data costuma preencher só um lado da Final/3º até atualizar o
 * bracket. Completa o lado faltante com vencedores (Final) ou perdedores (3º)
 * das semis encerradas.
 */
export function enrichKnockoutSlots(matches: ApiMatch[]): ApiMatch[] {
  const semis = matches.filter((m) => m.stage === 'SEMI_FINALS')
  const winners = semis.map(winnerTeam).filter((t): t is ApiTeam => Boolean(t?.name))
  const losers = semis.map(loserTeam).filter((t): t is ApiTeam => Boolean(t?.name))

  return matches.map((match) => {
    if (match.stage === 'FINAL' && winners.length > 0) {
      return fillMissingSide(match, winners)
    }
    if (match.stage === 'THIRD_PLACE' && losers.length > 0) {
      return fillMissingSide(match, losers)
    }
    return match
  })
}

function resolveSlotDisplay(team: ApiTeam | null | undefined): string {
  return resolveTeamDisplay(team ?? {}) ?? PLACEHOLDER_TEAM
}

export async function fetchCompetitionMatches(): Promise<ApiMatch[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN
  const competition = process.env.FOOTBALL_DATA_COMPETITION ?? 'WC'

  if (!token) {
    throw new Error('FOOTBALL_DATA_TOKEN não definido')
  }

  const url = `https://api.football-data.org/v4/competitions/${competition}/matches`
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': token },
  })

  if (!res.ok) {
    throw new Error(`API football-data retornou ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as { matches: ApiMatch[] }
  return enrichKnockoutSlots(data.matches ?? [])
}

export interface PartidaImport {
  id: string
  data: string
  hora: string
  fase: string
  time_casa: string
  time_fora: string
  gols_casa: number | null
  gols_fora: number | null
  status_api: string | null
  apiMatchId: number
}

export function apiMatchToPartidaImport(match: ApiMatch): PartidaImport | null {
  const time_casa = resolveSlotDisplay(match.homeTeam)
  const time_fora = resolveSlotDisplay(match.awayTeam)

  // Fase de grupos sem times = lixo; mata-mata TBD ainda deve entrar no bolão.
  if (
    match.stage === 'GROUP_STAGE' &&
    (isPlaceholderTeam(time_casa) || isPlaceholderTeam(time_fora))
  ) {
    return null
  }

  const { data, hora } = utcToBrParts(match.utcDate)
  const fase = stageToFase(match.stage)
  const score = extractScore(match)

  const id =
    match.stage === 'GROUP_STAGE'
      ? buildPartidaId(data, match.homeTeam, match.awayTeam)
      : knockoutPartidaId(match, data)

  return {
    id,
    data,
    hora,
    fase,
    time_casa,
    time_fora,
    gols_casa: score?.home ?? null,
    gols_fora: score?.away ?? null,
    status_api: match.status,
    apiMatchId: match.id,
  }
}
