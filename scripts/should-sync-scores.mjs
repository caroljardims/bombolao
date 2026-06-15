/**
 * Verifica se vale rodar o sync de placares (jogo ao vivo, prestes a começar ou acabou de encerrar).
 * Fonte primária: https://worldcup26.ir/get/games (gratuita, sem API key).
 */
import { appendFileSync } from 'node:fs'

const WC26_GAMES_URL = 'https://worldcup26.ir/get/games'
const WC_START = '2026-06-11'
const WC_END = '2026-07-19'

const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'LIVE', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'])

const PRE_KICKOFF_MS = 15 * 60 * 1000
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000
const POST_FINISH_MS = 20 * 60 * 1000

function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}

function isWcPeriod(date = todayUtc()) {
  return date >= WC_START && date <= WC_END
}

function parseLocalDateMs(localDate) {
  const [datePart, timePart = '12:00'] = localDate.trim().split(/\s+/)
  const [mm, dd, yyyy] = datePart.split('/')
  const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  return new Date(`${iso}T${timePart.slice(0, 5)}:00`).getTime()
}

function resolveStatus(game) {
  if (game.finished === 'TRUE' || game.time_elapsed === 'finished') return 'FINISHED'
  if (game.time_elapsed === 'notstarted') return 'TIMED'
  return 'IN_PLAY'
}

function matchNeedsSync(game, now) {
  const status = resolveStatus(game)
  if (LIVE_STATUSES.has(status)) return true

  const kickoff = parseLocalDateMs(game.local_date)
  if (!Number.isFinite(kickoff)) return false

  const untilKickoff = kickoff - now
  const sinceKickoff = now - kickoff

  if (status === 'TIMED' && untilKickoff <= PRE_KICKOFF_MS && sinceKickoff <= LIVE_WINDOW_MS) {
    return true
  }

  if (status === 'FINISHED') return sinceKickoff >= 0 && sinceKickoff <= POST_FINISH_MS

  return false
}

function writeOutput(shouldSync) {
  const value = shouldSync ? 'true' : 'false'
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `should_sync=${value}\n`)
  }
}

async function main() {
  if (!isWcPeriod()) {
    console.log('Fora do período da Copa — sync desnecessário.')
    writeOutput(false)
    return
  }

  let games = []
  try {
    const res = await fetch(WC26_GAMES_URL, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      console.warn(`WorldCup26 API retornou ${res.status} — assumindo sync necessário.`)
      writeOutput(true)
      return
    }
    const data = await res.json()
    games = data.games ?? []
  } catch (err) {
    console.warn(`Erro ao chamar WorldCup26 API: ${err.message} — assumindo sync necessário.`)
    writeOutput(true)
    return
  }

  const now = Date.now()
  const relevant = games.filter((g) => matchNeedsSync(g, now))
  const shouldSync = relevant.length > 0

  if (shouldSync) {
    console.log(
      `Sync necessário (${relevant.length} jogo(s)):`,
      relevant
        .slice(0, 3)
        .map(
          (g) =>
            `${g.home_team_name_en ?? '?'} x ${g.away_team_name_en ?? '?'} [${resolveStatus(g)} ${g.home_score}-${g.away_score}]`,
        )
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
