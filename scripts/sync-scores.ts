import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import type { Partida, Palpite } from '../src/lib/types'
import {
  calcularPontos,
  calcularPosicoes,
  contarEstatisticas,
  partidaEncerrada,
  temPalpite,
} from './lib/recalc'
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

interface ApiMatch {
  utcDate: string
  status: string
  homeTeam: { name: string; shortName?: string; tla?: string }
  awayTeam: { name: string; shortName?: string; tla?: string }
  score: {
    fullTime?: { home: number | null; away: number | null }
    regularTime?: { home: number | null; away: number | null }
    halfTime?: { home: number | null; away: number | null }
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

function extractScore(match: ApiMatch): { home: number; away: number } | null {
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

async function fetchApiMatches(): Promise<ApiMatch[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN
  const competition = process.env.FOOTBALL_DATA_COMPETITION ?? 'WC'

  if (!token) {
    console.log('⚠ FOOTBALL_DATA_TOKEN não definido — pulando fetch da API.')
    return []
  }

  const url = `https://api.football-data.org/v4/competitions/${competition}/matches`
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': token },
  })

  if (!res.ok) {
    console.warn(`API football-data retornou ${res.status}: ${await res.text()}`)
    return []
  }

  const data = (await res.json()) as { matches: ApiMatch[] }
  return data.matches ?? []
}

function findMatchingPartida(partidas: Partida[], apiMatch: ApiMatch): Partida | undefined {
  const apiDate = parsePartidaDate(apiMatch.utcDate)
  return partidas.find(
    (p) =>
      p.data === apiDate &&
      teamsMatch(p.time_casa, apiMatch.homeTeam) &&
      teamsMatch(p.time_fora, apiMatch.awayTeam),
  )
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

async function syncBolao(db: Firestore, bolaoId: string, apiMatches: ApiMatch[], recalcOnly: boolean) {
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const partidasSnap = await bolaoRef.collection('partidas').get()
  const partidas = partidasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida)

  if (!recalcOnly) {
    const batch = db.batch()
    let atualizados = 0

    for (const apiMatch of apiMatches) {
      if (!UPDATABLE_STATUS.has(apiMatch.status)) continue

      const partida = findMatchingPartida(partidas, apiMatch)
      if (!partida) continue

      const score = extractScore(apiMatch)
      if (!score) continue

      const sameScore =
        partida.gols_casa === score.home &&
        partida.gols_fora === score.away &&
        partida.status_api === apiMatch.status
      if (sameScore) continue

      batch.update(bolaoRef.collection('partidas').doc(partida.id), {
        gols_casa: score.home,
        gols_fora: score.away,
        status_api: apiMatch.status,
      })
      console.log(
        `  ↑ ${partida.time_casa} ${score.home}×${score.away} ${partida.time_fora} (${apiMatch.status})`,
      )
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

  let apiMatches: ApiMatch[] = []
  if (!recalcOnly) {
    console.log('Buscando placares da API…')
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
