/**
 * Preenche classificados FICTÍCIOS do mata-mata num bolão de TESTE, só pra
 * validar a aba Chave localmente. Faz duas coisas:
 *   1. fecha a fase de grupos com placares inventados (todos os grupos completos);
 *   2. cria os 16 jogos dos 16-avos (1º/2º resolvidos + 3ºs fictícios) como
 *      agendados (sem resultado), pra cravada e "por fase" ficarem abertas.
 *
 * Recusa rodar em bolões de produção.
 *
 * Uso:
 *   npm run seed-chave-ficticia -- --bolao-id teste-2-2
 *   npm run seed-chave-ficticia -- --bolao-id teste-2-2 --dry-run
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { buildEngine } from '../src/lib/knockoutBracket'
import { computeGroupStandings } from '../src/lib/standings'
import { BRACKET_TEMPLATE } from '../src/data/chaveBracketTemplate'
import type { Partida } from '../src/lib/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const PROJECT_ID = 'bombolao-9ea22'

const BLOQUEADOS = new Set(['colorados-do-inter'])

function loadDotEnv() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim()
  }
}

function findServiceAccountPath(): string | null {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const candidates = [join(root, 'service-account.json')]
  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) candidates.push(join(root, file))
  }
  return candidates.find((p) => existsSync(p)) ?? null
}

function initAdmin(): Firestore {
  if (getApps().length > 0) return getFirestore()
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (jsonEnv?.trim()) {
    initializeApp({ credential: cert(JSON.parse(jsonEnv)), projectId: PROJECT_ID })
    return getFirestore()
  }
  const credPath = findServiceAccountPath()
  if (!credPath) throw new Error('Credenciais Firebase não encontradas.')
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))), projectId: PROJECT_ID })
  return getFirestore()
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 ? process.argv[idx + 1] : undefined
}

const isGroupStage = (p: Partida) => /grupo|primeira fase|group/i.test(p.fase ?? '')
const nomeDe = (s: { tipo: string; nome?: string } | undefined) =>
  s && s.tipo === 'time' ? (s as { nome: string }).nome : null

async function run() {
  loadDotEnv()
  const dryRun = process.argv.includes('--dry-run')
  const bolaoId = getArg('--bolao-id')
  if (!bolaoId) {
    console.error('Uso: npm run seed-chave-ficticia -- --bolao-id teste-2-2')
    process.exit(1)
  }
  if (BLOQUEADOS.has(bolaoId)) {
    console.error(`✋ "${bolaoId}" é um bolão protegido. Este script só roda em bolões de teste.`)
    process.exit(1)
  }

  const db = initAdmin()
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const snap = await bolaoRef.collection('partidas').get()
  if (snap.empty) {
    console.error(`Bolão "${bolaoId}" não tem partidas (crie-o antes).`)
    process.exit(1)
  }

  const partidas = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Partida)

  // 1) Fecha a fase de grupos com placares fictícios.
  const updates = db.batch()
  let fechados = 0
  partidas.forEach((p, i) => {
    if (!isGroupStage(p)) return
    if (p.gols_casa != null && p.gols_fora != null && p.status_api === 'FINISHED') return
    const patch = { gols_casa: (i % 3) + 1, gols_fora: i % 3, status_api: 'FINISHED' as const }
    Object.assign(p, patch)
    if (!dryRun) updates.set(bolaoRef.collection('partidas').doc(p.id), patch, { merge: true })
    fechados++
  })
  if (!dryRun && fechados > 0) await updates.commit()
  console.log(`✓ ${fechados} jogo(s) de grupo fechado(s) com placar fictício`)

  // 2) Resolve 16-avos (1º/2º + 3ºs fictícios) e cria os jogos agendados.
  const grupos = partidas.filter(isGroupStage)
  const engine = buildEngine(grupos)
  const standings = computeGroupStandings(grupos)
  const thirds = [...standings.values()]
    .map((g) => g.teams[2]?.team)
    .filter((t): t is string => Boolean(t))
  let ti = 0

  const has16avos = (a: string, b: string) =>
    partidas.some(
      (p) =>
        /16 avos/i.test(p.fase ?? '') &&
        ((p.time_casa === a && p.time_fora === b) || (p.time_casa === b && p.time_fora === a)),
    )

  const create = db.batch()
  let criados = 0
  const r32 = BRACKET_TEMPLATE.filter((n) => n.fase === 'r32')
  r32.forEach((node, idx) => {
    const rt = engine.realTeams.get(node.id)
    const casa = nomeDe(rt?.A) ?? thirds[ti++]
    const fora = nomeDe(rt?.B) ?? thirds[ti++]
    if (!casa || !fora || has16avos(casa, fora)) return
    const id = `seed-${node.id}`
    const data = {
      data: '2026-06-28',
      hora: `${13 + (idx % 6)}:00`,
      fase: '16 avos de final',
      time_casa: casa,
      time_fora: fora,
      gols_casa: null,
      gols_fora: null,
      status_api: 'TIMED' as const,
    }
    console.log(`  + ${casa} × ${fora}`)
    if (!dryRun) create.set(bolaoRef.collection('partidas').doc(id), data)
    criados++
  })
  if (!dryRun && criados > 0) await create.commit()

  console.log(`✓ ${criados} jogo(s) de 16-avos criado(s)`)
  console.log(`\n${dryRun ? '(dry-run — nada gravado) ' : ''}Pronto. Abra /b/${bolaoId}/chave`)
}

run().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
