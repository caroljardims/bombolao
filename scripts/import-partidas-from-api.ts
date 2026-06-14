/**
 * Importa partidas da Copa (football-data.org) para um bolão no Firestore.
 * Cria jogos novos sem duplicar os que já existem (match por data + times).
 *
 * Uso:
 *   npm run import-partidas -- --bolao-id colorados-do-inter
 *   npm run import-partidas -- --bolao-id colorados-do-inter --dry-run
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { Partida } from '../src/lib/types'
import {
  apiMatchToPartidaImport,
  fetchCompetitionMatches,
  matchHasTeams,
  type ApiMatch,
} from './lib/footballData'
import { teamsMatch } from './lib/teamMatch'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const PROJECT_ID = 'bombolao-9ea22'

function loadDotEnv() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function findServiceAccountPath(): string | null {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const candidates = [join(root, 'service-account.json')]
  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) {
      candidates.push(join(root, file))
    }
  }
  return candidates.find((p) => existsSync(p)) ?? null
}

function parseServiceAccountJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválido.')
  }
}

function initAdmin() {
  if (getApps().length > 0) return getFirestore()

  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (jsonEnv?.trim()) {
    initializeApp({
      credential: cert(parseServiceAccountJson(jsonEnv)),
      projectId: PROJECT_ID,
    })
    return getFirestore()
  }

  const credPath = findServiceAccountPath()
  if (credPath) {
    initializeApp({
      credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))),
      projectId: PROJECT_ID,
    })
    return getFirestore()
  }

  throw new Error('Credenciais Firebase não encontradas.')
}

function parsePartidaDate(utcDate: string): string {
  return utcDate.slice(0, 10)
}

function findMatchingPartida(partidas: Partida[], apiMatch: ApiMatch): Partida | undefined {
  const apiDate = parsePartidaDate(apiMatch.utcDate)
  return partidas.find(
    (p) =>
      p.data === apiDate &&
      teamsMatch(p.time_casa, {
        name: apiMatch.homeTeam.name!,
        shortName: apiMatch.homeTeam.shortName ?? undefined,
        tla: apiMatch.homeTeam.tla ?? undefined,
      }) &&
      teamsMatch(p.time_fora, {
        name: apiMatch.awayTeam.name!,
        shortName: apiMatch.awayTeam.shortName ?? undefined,
        tla: apiMatch.awayTeam.tla ?? undefined,
      }),
  )
}

function getBolaoId(): string {
  const idx = process.argv.indexOf('--bolao-id')
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  const fromEnv = process.env.BOLAO_IDS?.split(',')[0]?.trim()
  if (fromEnv) return fromEnv
  return 'colorados-do-inter'
}

async function importPartidas() {
  loadDotEnv()
  const bolaoId = getBolaoId()
  const dryRun = process.argv.includes('--dry-run')
  const db = initAdmin()

  console.log(`Buscando jogos da Copa (WC)…`)
  const apiMatches = await fetchCompetitionMatches()
  console.log(`· ${apiMatches.length} jogos na API`)

  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const partidasSnap = await bolaoRef.collection('partidas').get()
  const existing = partidasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida)
  const existingIds = new Set(existing.map((p) => p.id))

  let criadas = 0
  let ignoradas = 0
  let pendentes = 0
  const batch = db.batch()
  const toCreate: string[] = []

  for (const apiMatch of apiMatches) {
    if (!matchHasTeams(apiMatch)) {
      pendentes++
      continue
    }

    const partidaImport = apiMatchToPartidaImport(apiMatch)
    if (!partidaImport) {
      console.warn(`  ! Não foi possível mapear: ${apiMatch.homeTeam.name} × ${apiMatch.awayTeam.name}`)
      continue
    }

    const duplicata = findMatchingPartida(existing, apiMatch)
    if (duplicata || existingIds.has(partidaImport.id)) {
      ignoradas++
      continue
    }

    const { id, apiMatchId: _apiId, ...data } = partidaImport
    toCreate.push(`${data.time_casa} × ${data.time_fora} (${data.data} ${data.hora}) [${id}]`)

    if (!dryRun) {
      batch.set(bolaoRef.collection('partidas').doc(id), data)
      existingIds.add(id)
    }
    criadas++
  }

  if (criadas > 0 && !dryRun) {
    await batch.commit()
    await bolaoRef.set(
      { ultimaImportacaoApi: new Date().toISOString(), totalPartidasApi: apiMatches.length },
      { merge: true },
    )
  }

  console.log(`\n— ${bolaoId}${dryRun ? ' (dry-run)' : ''}`)
  console.log(`✓ ${criadas} partida(s) nova(s)`)
  console.log(`· ${ignoradas} já existente(s)`)
  console.log(`· ${pendentes} aguardando times (mata-mata)`)

  if (toCreate.length > 0) {
    console.log('\nNovas partidas:')
    for (const line of toCreate.slice(0, 10)) console.log(`  + ${line}`)
    if (toCreate.length > 10) console.log(`  … e mais ${toCreate.length - 10}`)
  }

  if (dryRun) console.log('\n(dry-run — nada gravado no Firestore)')
}

importPartidas().catch((err) => {
  console.error('Erro no import:', err)
  process.exit(1)
})
