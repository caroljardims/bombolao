/**
 * Migra os palpites de chave do formato antigo da final para o novo:
 *   antigo: picks['final'] = campeão
 *   novo:   picks['final-campeao'] = campeão  +  picks['final-vice'] = outro finalista
 *
 * O vice é derivado dos picks de semifinal (sf-esq-1 / sf-dir-1). A chave antiga
 * `final` é removida. Não altera nenhuma seleção — só reformata.
 *
 * Uso:
 *   npm run migrate-chave-final -- --bolao-id colorados-do-inter --dry-run
 *   npm run migrate-chave-final -- --bolao-id colorados-do-inter
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { CAMPEAO_PICK, VICE_PICK } from '../src/lib/knockoutBracket'

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
  const dryRun = process.argv.includes('--dry-run')
  const bolaoId = getArg('--bolao-id')
  if (!bolaoId) {
    console.error('Uso: npm run migrate-chave-final -- --bolao-id colorados-do-inter')
    process.exit(1)
  }

  const db = initAdmin()
  const bolaoRef = db.collection('boloes').doc(bolaoId)
  const snap = await bolaoRef.collection('palpitesChave').get()
  console.log(`palpitesChave em ${bolaoId}: ${snap.size} doc(s)\n`)

  let migrados = 0
  for (const d of snap.docs) {
    const data = d.data()
    const picks: Record<string, string> = { ...(data.cravada?.picks ?? {}) }
    const campeao = picks['final']
    if (!campeao) continue // nada a migrar
    if (picks[CAMPEAO_PICK]) {
      // já tem o novo formato; só limpa a chave antiga se sobrou
      delete picks['final']
    } else {
      const fEsq = picks['sf-esq-1']
      const fDir = picks['sf-dir-1']
      const vice = campeao === fEsq ? fDir : campeao === fDir ? fEsq : undefined
      picks[CAMPEAO_PICK] = campeao
      if (vice) picks[VICE_PICK] = vice
      delete picks['final']
      console.log(`  ${d.id}: campeão=${campeao} vice=${vice ?? '(não derivado)'}`)
    }

    if (!dryRun) {
      await d.ref.update({ 'cravada.picks': picks })
    }
    migrados++
  }

  console.log(`\n${dryRun ? '(dry-run) ' : ''}✓ ${migrados} doc(s) migrado(s)`)
}

run().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
