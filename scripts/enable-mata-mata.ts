/**
 * Ativa a modalidade mata-mata em bolões já existentes, sem tocar em palpites,
 * partidas ou participantes. A regra da Copa (pesos da chave) é a mesma para
 * todos — bolões com ou sem histórico de palpites.
 *
 * Uso:
 *   npm run enable-mata-mata -- --all                 # todos os bolões
 *   npm run enable-mata-mata -- --bolao-id colorados-do-inter
 *   npm run enable-mata-mata -- --all --dry-run
 *   npm run enable-mata-mata -- --all --competicao "Copa do Mundo 2026"
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { DEFAULT_REGRAS_CHAVE } from '../src/lib/regras'

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
  const db = initAdmin()
  const dryRun = process.argv.includes('--dry-run')
  const all = process.argv.includes('--all')
  const bolaoId = getArg('--bolao-id')
  const competicaoFiltro = getArg('--competicao')

  if (!all && !bolaoId) {
    console.error('Uso: npm run enable-mata-mata -- --all   (ou --bolao-id <id>)')
    process.exit(1)
  }

  const snap = all
    ? await db.collection('boloes').get()
    : { docs: [await db.collection('boloes').doc(bolaoId!).get()] }

  let alterados = 0
  let pulados = 0

  for (const doc of snap.docs) {
    if (!doc.exists) {
      console.warn(`! bolão não encontrado: ${bolaoId}`)
      continue
    }
    const data = doc.data() as { nome?: string; competicao?: string; modalidade?: string; regrasChave?: unknown }

    if (competicaoFiltro && data.competicao !== competicaoFiltro) {
      pulados++
      continue
    }

    const patch: Record<string, unknown> = {}
    if (data.modalidade !== 'mata-mata') patch.modalidade = 'mata-mata'
    if (!data.regrasChave) patch.regrasChave = DEFAULT_REGRAS_CHAVE

    if (Object.keys(patch).length === 0) {
      console.log(`· ${doc.id} já está mata-mata`)
      pulados++
      continue
    }

    console.log(`✓ ${doc.id} (${data.nome ?? '—'}) → ${Object.keys(patch).join(', ')}`)
    if (!dryRun) await doc.ref.set(patch, { merge: true })
    alterados++
  }

  console.log(`\n${dryRun ? '(dry-run) ' : ''}${alterados} bolão(ões) atualizado(s), ${pulados} pulado(s).`)
}

run().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
