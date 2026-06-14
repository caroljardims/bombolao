/**
 * Verifica se vale rodar o sync de placares (jogo ao vivo, prestes a começar ou acabou de encerrar).
 */
import { appendFileSync } from 'node:fs'

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

function isWcPeriod(date = todayUtc()) {
  return date >= WC_START && date <= WC_END
}

function matchNeedsSync(match, now) {
  if (LIVE_STATUSES.has(match.status)) return true

  const kickoff = new Date(match.utcDate).getTime()
  if (!Number.isFinite(kickoff)) return false

  const untilKickoff = kickoff - now
  const sinceKickoff = now - kickoff

  if (
    (match.status === 'TIMED' || match.status === 'SCHEDULED') &&
    untilKickoff <= PRE_KICKOFF_MS &&
    sinceKickoff <= LIVE_WINDOW_MS
  ) {
    return true
  }

  if (match.status === 'FINISHED' && match.lastUpdated) {
    const updated = new Date(match.lastUpdated).getTime()
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
  const token = process.env.FOOTBALL_DATA_TOKEN
  if (!token) {
    console.error('FOOTBALL_DATA_TOKEN não definido')
    process.exit(1)
  }

  if (!isWcPeriod()) {
    console.log('Fora do período da Copa — sync desnecessário.')
    writeOutput(false)
    return
  }

  const competition = process.env.FOOTBALL_DATA_COMPETITION ?? 'WC'
  let data
  try {
    const res = await fetch(`https://api.football-data.org/v4/competitions/${competition}/matches`, {
      headers: { 'X-Auth-Token': token },
    })
    if (!res.ok) {
      console.warn(`API retornou ${res.status} — assumindo sync necessário.`)
      writeOutput(true)
      return
    }
    data = await res.json()
  } catch (err) {
    console.warn(`Erro ao chamar API: ${err.message} — assumindo sync necessário.`)
    writeOutput(true)
    return
  }
  const now = Date.now()
  const matches = data.matches ?? []
  const relevant = matches.filter((m) => matchNeedsSync(m, now))
  const shouldSync = relevant.length > 0

  if (shouldSync) {
    console.log(
      `Sync necessário (${relevant.length} jogo(s)):`,
      relevant
        .slice(0, 3)
        .map((m) => `${m.homeTeam?.name ?? '?'} x ${m.awayTeam?.name ?? '?'} [${m.status}]`)
        .join(', '),
    )
  } else {
    console.log('Nenhum jogo ao vivo ou na janela de kickoff — sync dispensado.')
  }

  writeOutput(shouldSync)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
