/**
 * Copia photoURL do Firebase Auth para os docs de participante (incl. IDs legados).
 * Uso: npm run sync-participant-photos -- colorados-do-inter
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function findServiceAccountPath(): string | null {
  for (const file of readdirSync(root)) {
    if (file.includes('firebase-adminsdk') && file.endsWith('.json')) {
      return join(root, file)
    }
  }
  return existsSync(join(root, 'service-account.json')) ? join(root, 'service-account.json') : null
}

function initAdmin() {
  if (getApps().length > 0) return { db: getFirestore(), auth: getAuth() }
  const credPath = findServiceAccountPath()
  if (!credPath) throw new Error('Service account não encontrada')
  initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf-8'))) })
  return { db: getFirestore(), auth: getAuth() }
}

async function main() {
  const bolaoId = process.argv[2]
  if (!bolaoId) {
    console.error('Uso: npm run sync-participant-photos -- <bolao-id>')
    process.exit(1)
  }

  const { db, auth } = initAdmin()
  const participantesSnap = await db.collection('boloes').doc(bolaoId).collection('participantes').get()

  let updated = 0
  let skipped = 0

  for (const doc of participantesSnap.docs) {
    const email = (doc.data().email as string | undefined)?.trim().toLowerCase()
    if (!email) {
      skipped++
      continue
    }

    try {
      const user = await auth.getUserByEmail(email)
      if (!user.photoURL) {
        skipped++
        continue
      }

      const current = doc.data().photoURL as string | null | undefined
      if (current === user.photoURL) {
        skipped++
        continue
      }

      await doc.ref.set({ photoURL: user.photoURL }, { merge: true })
      console.log(`✓ ${doc.id} (${doc.data().nome})`)
      updated++
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? (err as { code: string }).code : ''
      if (code === 'auth/user-not-found') {
        skipped++
        continue
      }
      console.warn(`⚠ ${doc.id}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`\nConcluído: ${updated} atualizados, ${skipped} ignorados.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
