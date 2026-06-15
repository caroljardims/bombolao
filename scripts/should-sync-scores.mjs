/**
 * Verifica se vale rodar o sync de placares (jogo ao vivo, prestes a começar ou acabou de encerrar).
 * Usa World Cup API: https://worldcupapi.com/documentation
 */
import { appendFileSync } from 'node:fs'

const API_BASE = 'https://api.worldcupapi.com'
const WC_START = '2026-06-11'
const WC_END = '2026-07-19'

const LIVE_STATUSES = new Set([
  'IN_PLAY',
  'PAUSED',
  'LIVE',
  'EXTRA_TIME',
  'PENALTY_SHOOTOUT',
])

const PRE_KICKOFF_MS = 15 * 60 * 1000
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000
const POST_FINISH_MS = 20 * 60 * 1000

function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}

function todaySaoPaulo() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function isWcPeriod(date = todayUtc()) {
  return date >= WC_START && date <= WC_END
}

function normalizeStatus(status = '') {
  return status.trim().toUpperCase().replace(/\s+/g, '_')
}

function unwrapMatches(body) {
  if (Array.isArray(body)) return body
  if (body && typeof body === 'object' && body.success !== false && Array.isArray(body.data)) {
    return body.data
  }
  return []
}

async function fetchEndpoint(path, key, params = {}) {
  const url = new URL(`${API_BASE}/${path}`)
  url.searchParams.set('key', key)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
  }
  const res = await fetch(url)
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error ?? res.statusText)
  return unwrapMatches(body)
}

function buildKickoffMs(match, fallbackDate) {
  const date = match.date ?? fallbackDate
  const clock = match.scheduled ?? (match.time?.includes(':') ? match.time : null)
  if (!clock) return NaN
  const hhmm = clock.slice(0, 5)
  return new Date(`${date}T${hhmm}:00`).getTime()
}

function matchNeedsSync(match, now, fallbackDate) {
  const status = normalizeStatus(match.status)
  if (LIVE_STATUSES.has(status)) return true

  const kickoff = buildKickoffMs(match, fallbackDate)
  if (!Number.isFinite(kickoff)) return false

  const untilKickoff = kickoff - now
  const sinceKickoff = now - kickoff

  if (
    (status === 'TIMED' || status === 'SCHEDULED') &&
    untilKickoff <= PRE_KICKOFF_MS &&
    sinceKickoff <= LIVE_WINDOW_MS
  ) {
    return true
  }

  if (status === 'FINISHED' && match.last_changed) {
    const updated = new Date(match.last_changed.replace(' ', 'T') + 'Z').getTime()
    if (Number.isFinite(updated) && now - updated <= POST_FINISH_MS) return true
  }

  return false
}

function writeOutput(shouldSync) {
  const value = shouldSync ? 'true' : 'false'
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `should_sync=${value}\n`)
  }
}

async function main() {
  const key = process.env.WORLDCUP_API_KEY
  if (!key) {
    console.warn('WORLDCUP_API_KEY não definido — assumindo sync necessário.')
    writeOutput(true)
    return
  }

  if (!isWcPeriod()) {
    console.log('Fora do período da Copa — sync desnecessário.')
    writeOutput(false)
    return
  }

  const today = todaySaoPaulo()
  let matches = []
  try {
    const [live, history] = await Promise.all([
      fetchEndpoint('livescores', key),
      fetchEndpoint('history', key, { date_from: today, date_to: today }),
    ])
    matches = [...live, ...history]
  } catch (err) {
    console.warn(`Erro ao chamar World Cup API: ${err.message} — assumindo sync necessário.`)
    writeOutput(true)
    return
  }

  const now = Date.now()
  const relevant = matches.filter((m) => matchNeedsSync(m, now, today))
  const shouldSync = relevant.length > 0

  if (shouldSync) {
    console.log(
      `Sync necessário (${relevant.length} jogo(s)):`,
      relevant
        .slice(0, 3)
        .map((m) => `${m.home?.name ?? '?'} x ${m.away?.name ?? '?'} [${m.status}]`)
        .join(', '),
    )
  } else {
    console.log('Nenhum jogo ao vivo ou na janela de kickoff — sync dispensado.')
  }

  writeOutput(shouldSync)
}

main().catch((err) => {
  console.warn(`Erro inesperado: ${err.message} — assumindo sync necessário.`)
  writeOutput(true)
})
