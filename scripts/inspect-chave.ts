/**
 * READ-ONLY — imprime os docs de palpitesChave de um bolão (cravada/flex) para
 * diagnóstico. Não grava nada.
 *
 * Uso: npm run inspect-chave -- --bolao-id colorados-do-inter
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

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
  const bolaoId = getArg('--bolao-id')
  if (!bolaoId) {
    console.error('Uso: npm run inspect-chave -- --bolao-id colorados-do-inter')
    process.exit(1)
  }
  const db = initAdmin()
  const bolaoRef = db.collection('boloes').doc(bolaoId)

  const parts = new Map<string, string>()
  for (const d of (await bolaoRef.collection('participantes').get()).docs) {
    parts.set(d.id, (d.data().nome as string) ?? '?')
  }

  const snap = await bolaoRef.collection('palpitesChave').get()
  console.log(`palpitesChave em ${bolaoId}: ${snap.size} doc(s)\n`)
  for (const d of snap.docs) {
    const data = d.data()
    const nome = parts.get(d.id) ?? data.participante_id ?? '?'
    console.log(`── ${nome} (${d.id}) ──`)
    console.log(`  travadoEm: ${data.cravada?.travadoEm ?? '(não travada)'}`)
    const picks = data.cravada?.picks ?? {}
    const keys = Object.keys(picks)
    console.log(`  cravada.picks (${keys.length}):`)
    for (const k of keys.sort()) console.log(`    ${k} → ${picks[k]}`)
    if (data.flex) console.log(`  flex fases: ${Object.keys(data.flex).join(', ')}`)
    console.log('')
  }
}

run().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
