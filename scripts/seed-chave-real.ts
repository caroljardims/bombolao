/**
 * Seeda os 16-avos REAIS da Copa 2026 num bolão de TESTE (confrontos oficiais,
 * incluindo os 3ºs colocados certos), pra validar a aba Chave com o bracket real.
 *
 * Diferente de seed-chave-ficticia (que inventa os 3ºs), aqui os 16 confrontos
 * são fixos. Fecha a fase de grupos se ainda estiver aberta (placar fictício só
 * pra resolver 1º/2º) e recria os jogos dos 16-avos como agendados.
 *
 * Recusa rodar em bolões de produção.
 *
 * Uso:
 *   npm run seed-chave-real -- --bolao-id teste-2-2
 *   npm run seed-chave-real -- --bolao-id teste-2-2 --dry-run
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { wc2026MataPartidas } from '../src/data/competicoes/wc2026Mata'

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

async function run() {
  loadDotEnv()
  const dryRun = process.argv.includes('--dry-run')
  const bolaoId = getArg('--bolao-id')
  if (!bolaoId) {
    console.error('Uso: npm run seed-chave-real -- --bolao-id teste-2-2')
    process.exit(1)
  }
  if (BLOQUEADOS.has(bolaoId)) {
    console.error(`✋ "${bolaoId}" é protegido. Este script só roda em bolões de teste.`)
    process.exit(1)
  }

  const db = initAdmin()
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const snap = await bolaoRef.collection('partidas').get()

  // 1) Remove TODAS as partidas atuais — um bolão mata-mata só tem os 16-avos.
  const delBatch = db.batch()
  for (const d of snap.docs) {
    if (!dryRun) delBatch.delete(bolaoRef.collection('partidas').doc(d.id))
  }
  if (!dryRun && snap.size > 0) await delBatch.commit()
  console.log(`✓ ${snap.size} partida(s) antiga(s) removida(s)`)

  // 2) Cria os 16 confrontos reais (id `r32-{no}` casa direto no bracket).
  const create = db.batch()
  const partidas = wc2026MataPartidas()
  for (const p of partidas) {
    console.log(`  + ${p.time_casa} × ${p.time_fora}  (${p.id})`)
    if (!dryRun) {
      create.set(bolaoRef.collection('partidas').doc(p.id!), {
        data: p.data,
        hora: p.hora,
        fase: p.fase,
        time_casa: p.time_casa,
        time_fora: p.time_fora,
        gols_casa: null,
        gols_fora: null,
        status_api: 'TIMED' as const,
      })
    }
  }
  if (!dryRun) await create.commit()

  console.log(`✓ ${partidas.length} confronto(s) real(is) criado(s)`)
  console.log(`\n${dryRun ? '(dry-run — nada gravado) ' : ''}Pronto. Abra /b/${bolaoId}/chave`)
}

run().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
