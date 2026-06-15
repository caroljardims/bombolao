import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import type { Partida, Palpite } from '../src/lib/types'
import { getKickoffDate, isPastKickoff } from '../src/lib/dates'
import {
  calcularPontos,
  calcularPosicoes,
  contarEstatisticas,
  partidaEncerrada,
  temPalpite,
} from './lib/recalc'
import { teamsMatch } from './lib/teamMatch'
import { fetchWorldCupMatches, getWorldCupApiKey, type NormalizedMatch } from './lib/worldCupApi'

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

const UPDATABLE_STATUS = new Set([
  'FINISHED',
  'AWARDED',
  'IN_PLAY',
  'PAUSED',
  'LIVE',
  'EXTRA_TIME',
  'PENALTY_SHOOTOUT',
])

const PENDING_API_STATUS = new Set(['TIMED', 'SCHEDULED'])

/** Após o apito, inferir ao vivo por até ~2h30 se a API ainda não atualizou. */
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000

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
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON inválido. Cole o JSON completo da service account (uma linha ou formatado).',
    )
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

  throw new Error(
    'Credenciais Firebase não encontradas. No GitHub Actions, configure o secret FIREBASE_SERVICE_ACCOUNT_JSON com o JSON da service account.',
  )
}

function parsePartidaDate(utcDate: string): string {
  return utcDate.slice(0, 10)
}

function extractScore(match: NormalizedMatch): { home: number; away: number } | null {
  const blocks = [match.score.fullTime, match.score.halfTime]
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

async function fetchApiMatches(): Promise<NormalizedMatch[]> {
  const key = getWorldCupApiKey()
  if (!key) {
    console.log('⚠ WORLDCUP_API_KEY não definido — pulando fetch da API.')
    return []
  }

  try {
    const matches = await fetchWorldCupMatches(key)
    console.log(`  ${matches.length} jogo(s) retornados pela World Cup API`)
    return matches
  } catch (err) {
    console.warn(`API World Cup falhou: ${err instanceof Error ? err.message : err}`)
    return []
  }
}

function findMatchingPartida(partidas: Partida[], apiMatch: NormalizedMatch): Partida | undefined {
  const apiDate = parsePartidaDate(apiMatch.utcDate)
  return partidas.find(
    (p) =>
      p.data === apiDate &&
      teamsMatch(p.time_casa, apiMatch.homeTeam) &&
      teamsMatch(p.time_fora, apiMatch.awayTeam),
  )
}

function isWithinLiveWindow(partida: Partida, now = new Date()): boolean {
  const elapsed = now.getTime() - getKickoffDate(partida).getTime()
  return elapsed >= 0 && elapsed <= LIVE_WINDOW_MS
}

function resolveStatusApi(partida: Partida, apiStatus: string, now = new Date()): string {
  if (
    PENDING_API_STATUS.has(apiStatus) &&
    isPastKickoff(partida, now) &&
    isWithinLiveWindow(partida, now) &&
    !partidaEncerrada(partida)
  ) {
    return 'IN_PLAY'
  }
  return apiStatus
}

type PartidaPatch = {
  gols_casa?: number
  gols_fora?: number
  status_api: string
}

function buildPartidaPatch(partida: Partida, apiMatch: NormalizedMatch, now = new Date()): PartidaPatch | null {
  const resolvedStatus = resolveStatusApi(partida, apiMatch.status, now)
  const apiUpdatable = UPDATABLE_STATUS.has(apiMatch.status)
  const inferredLive = resolvedStatus === 'IN_PLAY' && PENDING_API_STATUS.has(apiMatch.status)

  if (!apiUpdatable && !inferredLive) return null

  const score = extractScore(apiMatch)
  const status_api = apiUpdatable ? apiMatch.status : 'IN_PLAY'

  if (score) {
    if (
      partida.gols_casa === score.home &&
      partida.gols_fora === score.away &&
      partida.status_api === status_api
    ) {
      return null
    }
    return { gols_casa: score.home, gols_fora: score.away, status_api }
  }

  if (partida.status_api === status_api) return null
  return { status_api }
}

async function recalcAll(db: Firestore, bolaoId: string) {
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const partidasSnap = await bolaoRef.collection('partidas').get()
  const partidasMap = new Map<string, Partida>()
  partidasSnap.docs.forEach((d) => partidasMap.set(d.id, { id: d.id, ...d.data() } as Partida))

  const palpitesSnap = await bolaoRef.collection('palpites').get()
  const batchPalpites = db.batch()
  let palpitesAtualizados = 0

  for (const doc of palpitesSnap.docs) {
    const palpite = { id: doc.id, ...doc.data() } as Palpite
    const partida = partidasMap.get(palpite.partida_id)
    if (!partida || !partidaEncerrada(partida)) continue

    let pontos = 0
    if (temPalpite(palpite)) {
      pontos = calcularPontos(
        { casa: partida.gols_casa!, fora: partida.gols_fora! },
        { casa: palpite.palpite_casa!, fora: palpite.palpite_fora! },
      )
    }

    if (palpite.pontos !== pontos) {
      batchPalpites.update(doc.ref, { pontos })
      palpitesAtualizados++
    }
  }

  if (palpitesAtualizados > 0) {
    await batchPalpites.commit()
    console.log(`  ✓ ${palpitesAtualizados} palpites recalculados`)
  }

  const participantesSnap = await bolaoRef.collection('participantes').get()
  const statsList: ({ id: string } & ReturnType<typeof contarEstatisticas>)[] = []

  for (const pDoc of participantesSnap.docs) {
    const palpitesDoParticipante = palpitesSnap.docs
      .filter((d) => d.data().participante_id === pDoc.id)
      .map((d) => ({ id: d.id, ...d.data() }) as Palpite)

    const stats = contarEstatisticas(palpitesDoParticipante, partidasMap)
    statsList.push({ id: pDoc.id, ...stats })
  }

  const posicoes = calcularPosicoes(statsList)
  const batchParticipantes = db.batch()

  for (const entry of statsList) {
    batchParticipantes.update(bolaoRef.collection('participantes').doc(entry.id), {
      total_pontos: entry.total_pontos,
      na_mosca: entry.na_mosca,
      acerto_resultado: entry.acerto_resultado,
      sem_aposta: entry.sem_aposta,
      posicao: posicoes.get(entry.id) ?? 99,
    })
  }

  await batchParticipantes.commit()
  console.log(`  ✓ ${statsList.length} participantes atualizados no ranking`)
}

function getBolaoIds(db: Firestore): Promise<string[]> {
  if (process.argv.includes('--all')) {
    return db.collection('boloes').get().then((snap) => snap.docs.map((d) => d.id))
  }

  const fromEnv = process.env.BOLAO_IDS
  if (fromEnv) {
    return Promise.resolve(fromEnv.split(',').map((id) => id.trim()).filter(Boolean))
  }

  const idx = process.argv.indexOf('--bolao-id')
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error('Uso: npm run sync-scores -- --bolao-id colorados-do-inter')
    console.error('     npm run sync-scores -- --all')
    process.exit(1)
  }
  return Promise.resolve([process.argv[idx + 1]])
}

async function syncBolao(db: Firestore, bolaoId: string, apiMatches: NormalizedMatch[], recalcOnly: boolean) {
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const partidasSnap = await bolaoRef.collection('partidas').get()
  const partidas = partidasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida)

  if (!recalcOnly) {
    const batch = db.batch()
    let atualizados = 0

    for (const apiMatch of apiMatches) {
      const partida = findMatchingPartida(partidas, apiMatch)
      if (!partida) continue

      const patch = buildPartidaPatch(partida, apiMatch)
      if (!patch) continue

      batch.update(bolaoRef.collection('partidas').doc(partida.id), patch)

      if (patch.gols_casa !== undefined && patch.gols_fora !== undefined) {
        console.log(
          `  ↑ ${partida.time_casa} ${patch.gols_casa}×${patch.gols_fora} ${partida.time_fora} (${patch.status_api})`,
        )
      } else {
        console.log(`  ↑ ${partida.time_casa} × ${partida.time_fora} (${patch.status_api})`)
      }
      atualizados++
    }

    if (atualizados > 0) {
      await batch.commit()
      console.log(`✓ ${atualizados} partida(s) atualizada(s)`)
    } else if (apiMatches.length > 0) {
      console.log('· Nenhum placar novo encontrado na API')
    }

    await bolaoRef.update({ ultimaSyncApi: new Date().toISOString() })
  }

  console.log(`Recalculando ranking (${bolaoId})…`)
  await recalcAll(db, bolaoId)
}

async function syncScores() {
  loadDotEnv()
  const db = initAdmin()
  const bolaoIds = await getBolaoIds(db)
  const recalcOnly = process.argv.includes('--recalc-only')

  let apiMatches: NormalizedMatch[] = []
  if (!recalcOnly) {
    console.log('Buscando placares na World Cup API…')
    apiMatches = await fetchApiMatches()
  }

  for (const bolaoId of bolaoIds) {
    console.log(`\n— ${bolaoId}`)
    await syncBolao(db, bolaoId, apiMatches, recalcOnly)
  }

  console.log('\n✅ Sync concluído')
}

syncScores().catch((err) => {
  console.error('Erro no sync:', err)
  process.exit(1)
})
