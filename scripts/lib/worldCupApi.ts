/**
 * Cliente da World Cup API (https://worldcupapi.com).
 * Docs: https://worldcupapi.com/documentation
 */

const API_BASE = 'https://api.worldcupapi.com'

export interface NormalizedMatch {
  utcDate: string
  status: string
  homeTeam: { name: string; shortName?: string; tla?: string }
  awayTeam: { name: string; shortName?: string; tla?: string }
  score: {
    fullTime?: { home: number | null; away: number | null }
    halfTime?: { home: number | null; away: number | null }
  }
  lastUpdated?: string
}

interface WcTeam {
  id?: number
  name: string
  logo?: string
}

interface WcScores {
  score?: string
  ht_score?: string
  ft_score?: string
  et_score?: string
  ps_score?: string
}

interface WcRawMatch {
  id?: number
  date?: string
  scheduled?: string
  time?: string
  status?: string
  last_changed?: string
  home: WcTeam
  away: WcTeam
  scores?: WcScores
}

function todaySaoPaulo(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function offsetDate(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function normalizeStatus(status: string): string {
  return status.trim().toUpperCase().replace(/\s+/g, '_')
}

export function parseScoreString(raw: string): { home: number; away: number } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const m = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
  if (!m) return null
  return { home: Number(m[1]), away: Number(m[2]) }
}

function buildUtcDate(match: WcRawMatch, fallbackDate: string): string {
  const date = match.date ?? fallbackDate
  const clock = match.scheduled ?? (match.time && match.time.includes(':') ? match.time : null)
  const hhmm = clock ? clock.slice(0, 5) : '12:00'
  return `${date}T${hhmm}:00`
}

function extractScores(match: WcRawMatch, status: string) {
  const scores = match.scores ?? {}
  const normalized = normalizeStatus(status)
  const primary =
    normalized === 'FINISHED' && scores.ft_score
      ? scores.ft_score
      : scores.score ?? scores.ft_score ?? ''
  const fullTime = parseScoreString(primary)
  const halfTime = parseScoreString(scores.ht_score ?? '')

  return {
    fullTime: fullTime ?? undefined,
    halfTime: halfTime ?? undefined,
  }
}

export function normalizeWcMatch(match: WcRawMatch, fallbackDate: string): NormalizedMatch {
  const status = normalizeStatus(match.status ?? 'TIMED')
  const parsed = extractScores(match, status)

  return {
    utcDate: buildUtcDate(match, fallbackDate),
    status,
    homeTeam: { name: match.home.name },
    awayTeam: { name: match.away.name },
    score: {
      fullTime: parsed.fullTime ?? null,
      halfTime: parsed.halfTime ?? null,
    },
    lastUpdated: match.last_changed,
  }
}

function unwrapMatches(body: unknown): WcRawMatch[] {
  if (Array.isArray(body)) return body as WcRawMatch[]
  if (body && typeof body === 'object') {
    const record = body as { success?: boolean; data?: unknown; error?: string }
    if (record.success === false) {
      throw new Error(record.error ?? 'World Cup API retornou erro')
    }
    if (Array.isArray(record.data)) return record.data as WcRawMatch[]
  }
  return []
}

async function fetchEndpoint(
  path: string,
  key: string,
  params: Record<string, string> = {},
): Promise<WcRawMatch[]> {
  const url = new URL(`${API_BASE}/${path}`)
  url.searchParams.set('key', key)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
  }

  const res = await fetch(url)
  const body = await res.json()

  if (body && typeof body === 'object' && 'success' in body && (body as { success: boolean }).success === false) {
    throw new Error((body as { error?: string }).error ?? 'World Cup API retornou erro')
  }

  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: string }).error)
        : await (async () => {
            try {
              return JSON.stringify(body)
            } catch {
              return res.statusText
            }
          })()
    throw new Error(`World Cup API ${path} retornou ${res.status}: ${msg}`)
  }

  return unwrapMatches(body)
}

function dedupeKey(match: NormalizedMatch): string {
  const date = match.utcDate.slice(0, 10)
  return `${date}|${match.homeTeam.name}|${match.awayTeam.name}`.toLowerCase()
}

function mergeMatches(...groups: NormalizedMatch[][]): NormalizedMatch[] {
  const map = new Map<string, NormalizedMatch>()
  for (const group of groups) {
    for (const match of group) {
      const key = dedupeKey(match)
      const existing = map.get(key)
      if (!existing) {
        map.set(key, match)
        continue
      }
      const liveStatuses = new Set(['IN_PLAY', 'PAUSED', 'LIVE', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'])
      if (liveStatuses.has(match.status) || (match.score.fullTime && !existing.score.fullTime)) {
        map.set(key, match)
      }
    }
  }
  return [...map.values()]
}

export async function fetchWorldCupMatches(key: string, now = new Date()): Promise<NormalizedMatch[]> {
  const today = todaySaoPaulo(now)
  const yesterday = offsetDate(today, -1)

  const [live, historyToday, historyYesterday] = await Promise.all([
    fetchEndpoint('livescores', key).catch((err) => {
      console.warn(`livescores: ${err.message}`)
      return [] as WcRawMatch[]
    }),
    fetchEndpoint('history', key, { date_from: today, date_to: today }).catch((err) => {
      console.warn(`history (hoje): ${err.message}`)
      return [] as WcRawMatch[]
    }),
    fetchEndpoint('history', key, { date_from: yesterday, date_to: yesterday }).catch((err) => {
      console.warn(`history (ontem): ${err.message}`)
      return [] as WcRawMatch[]
    }),
  ])

  return mergeMatches(
    live.map((m) => normalizeWcMatch(m, today)),
    historyToday.map((m) => normalizeWcMatch(m, today)),
    historyYesterday.map((m) => normalizeWcMatch(m, yesterday)),
  )
}

export function getWorldCupApiKey(): string | undefined {
  return process.env.WORLDCUP_API_KEY?.trim() || undefined
}
