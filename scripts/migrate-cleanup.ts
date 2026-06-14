/**
 * Remove coleções root legadas após migração validada.
 * Uso: npm run migrate:cleanup
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applicationDefault, cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const PROJECT_ID = 'bombolao-9ea22'

function findServiceAccountPath(): string | null {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) {
      return join(root, file)
    }
  }
  return existsSync(join(root, 'service-account.json')) ? join(root, 'service-account.json') : null
}

function initAdmin() {
  if (getApps().length > 0) return getFirestore()
  const credPath = findServiceAccountPath()
  if (credPath) {
    initializeApp({
      credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))),
      projectId: PROJECT_ID,
    })
  } else {
    initializeApp({ projectId: PROJECT_ID })
  }
  return getFirestore()
}

async function deleteCollection(db: FirebaseFirestore.Firestore, path: string) {
  const snap = await db.collection(path).get()
  if (snap.empty) {
    console.log(`· ${path}: vazio`)
    return
  }
  const batch = db.batch()
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
  console.log(`✓ ${path}: ${snap.size} docs removidos`)
}

async function cleanup() {
  const db = initAdmin()
  console.log('\n🧹 Limpando coleções root legadas…\n')
  await deleteCollection(db, 'palpites')
  await deleteCollection(db, 'participantes')
  await deleteCollection(db, 'partidas')
  const bolaoConfig = await db.collection('bolao').doc('config').get()
  if (bolaoConfig.exists) {
    await bolaoConfig.ref.delete()
    console.log('✓ bolao/config removido')
  }
  console.log('\n✅ Limpeza concluída.\n')
}

cleanup().catch((err) => {
  console.error(err)
  process.exit(1)
})
